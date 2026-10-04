import UIKit
import Capacitor
import WebKit
import AVFoundation

private final class PlayerMessageHandler: NSObject, WKScriptMessageHandler {
    weak var owner: PlayerBridgeViewController?

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame,
              message.frameInfo.securityOrigin.protocol == "capacitor",
              message.frameInfo.securityOrigin.host == "localhost",
              let body = message.body as? [String: Any] else { return }
        if body["action"] as? String == "openBrowser" {
            owner?.openYouTubeBrowser()
        } else if body["action"] as? String == "startPiP" {
            owner?.startPiP()
        } else if body["action"] as? String == "getVideoMetadata", let videoID = body["videoId"] as? String {
            owner?.fetchVideoMetadata(videoID)
        } else {
            owner?.updatePlayer(body)
        }
    }
}

private final class PiPMessageHandler: NSObject, WKScriptMessageHandler {
    weak var owner: PlayerBridgeViewController?

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let owner = owner, message.webView === owner.videoWebView,
              message.frameInfo.securityOrigin.protocol == "https",
              ["www.youtube.com", "www.youtube-nocookie.com"].contains(message.frameInfo.securityOrigin.host),
              let body = message.body as? [String: Any], let state = body["state"] as? String else { return }
        if state == "ready" { owner.pipFrame = message.frameInfo }
        else if ["active", "inline", "unavailable"].contains(state) { owner.reportPiP(state) }
    }
}

class PlayerBridgeViewController: CAPBridgeViewController {
    private lazy var playerMessageHandler: PlayerMessageHandler = {
        let handler = PlayerMessageHandler()
        handler.owner = self
        return handler
    }()
    fileprivate var videoWebView: WKWebView?
    fileprivate var pipFrame: WKFrameInfo?
    private var pipIsActive = false
    private lazy var pipMessageHandler: PiPMessageHandler = {
        let handler = PiPMessageHandler()
        handler.owner = self
        return handler
    }()

    fileprivate func reportPiP(_ state: String) {
        if state == "active" { pipIsActive = true }
        if state == "inline" || state == "unavailable" { pipIsActive = false }
        guard let data = try? JSONSerialization.data(withJSONObject: ["state": state]),
              let json = String(data: data, encoding: .utf8) else { return }
        webView?.evaluateJavaScript("window.dispatchEvent(new CustomEvent('youtube:pip-status', {detail: \(json)}));", completionHandler: nil)
    }

    fileprivate func startPiP() {
        guard let player = videoWebView, let frame = pipFrame else {
            reportPiP("unavailable")
            return
        }
        player.evaluateJavaScript("window.__startYouTubePiP()", in: frame, in: .page) { [weak self] result in
            if case .failure = result { self?.reportPiP("unavailable") }
        }
    }

    fileprivate func startPiPWhenBackgrounding() {
        guard let player = videoWebView, let frame = pipFrame else { return }
        // Do not trust the last reported state here. WebKit occasionally misses
        // the inline event after PiP closes; the page-side function is idempotent
        // and checks the actual video presentation mode.
        player.evaluateJavaScript("window.__startYouTubePiPIfPlaying?.()", in: frame, in: .page) { [weak self] result in
            if case .failure = result { self?.reportPiP("unavailable") }
        }
    }

    fileprivate func recoverPiPAfterForeground() {
        guard pipIsActive, let player = videoWebView, pipFrame != nil else { return }
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .moviePlayback)
            try session.setActive(true)
        } catch {
            NSLog("Unable to reactivate PiP audio session: %@", error.localizedDescription)
        }

        player.setNeedsLayout()
        player.layoutIfNeeded()
        let recover = { [weak self] in
            guard let self, let currentFrame = self.pipFrame else { return }
            player.evaluateJavaScript("window.__recoverYouTubePiP?.()", in: currentFrame, in: .page) { _ in }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15, execute: recover)
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0, execute: recover)
    }

    fileprivate func fetchVideoMetadata(_ videoID: String) {
        guard videoID.range(of: "^[A-Za-z0-9_-]{11}$", options: .regularExpression) != nil,
              var components = URLComponents(string: "https://www.youtube.com/oembed") else { return }
        components.queryItems = [
            URLQueryItem(name: "url", value: "https://www.youtube.com/watch?v=\(videoID)"),
            URLQueryItem(name: "format", value: "json")
        ]
        guard let url = components.url else { return }
        URLSession.shared.dataTask(with: url) { [weak self] data, _, _ in
            guard let data,
                  let response = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let title = response["title"] as? String else { return }
            let thumbnailURL = response["thumbnail_url"] as? String ?? "https://i.ytimg.com/vi/\(videoID)/hqdefault.jpg"
            let detail: [String: String] = ["videoId": videoID, "title": title, "thumbnailUrl": thumbnailURL]
            guard let jsonData = try? JSONSerialization.data(withJSONObject: detail),
                  let json = String(data: jsonData, encoding: .utf8) else { return }
            DispatchQueue.main.async {
                self?.webView?.evaluateJavaScript("window.dispatchEvent(new CustomEvent('youtube:video-metadata', {detail: \(json)}));", completionHandler: nil)
            }
        }.resume()
    }


    fileprivate func openYouTubeBrowser() {
        guard presentedViewController == nil else { return }
        let browser = YouTubeBrowserViewController()
        browser.onSelection = { [weak self] url in
            guard let data = try? JSONSerialization.data(withJSONObject: ["url": url]),
                  let json = String(data: data, encoding: .utf8) else { return }
            self?.webView?.evaluateJavaScript("window.dispatchEvent(new CustomEvent('youtube:video-selected', {detail: \(json)}));", completionHandler: nil)
        }
        let navigation = UINavigationController(rootViewController: browser)
        navigation.modalPresentationStyle = .fullScreen
        present(navigation, animated: true)
    }

    fileprivate func updatePlayer(_ body: [String: Any]) {
        guard let webView = webView else { return }
        if let videoID = body["videoId"] as? String {
            guard videoID.range(of: "^[A-Za-z0-9_-]{11}$", options: .regularExpression) != nil,
                  let bundleID = Bundle.main.bundleIdentifier,
                  let identity = URL(string: "https://\(bundleID.lowercased())") else { return }
            var components = URLComponents(string: "https://www.youtube-nocookie.com/embed/\(videoID)")!
            components.queryItems = [
                URLQueryItem(name: "autoplay", value: "1"),
                URLQueryItem(name: "playsinline", value: "1"),
                URLQueryItem(name: "rel", value: "0"),
                URLQueryItem(name: "origin", value: identity.absoluteString)
            ]
            if body["loop"] as? Bool == true {
                components.queryItems?.append(contentsOf: [
                    URLQueryItem(name: "loop", value: "1"),
                    URLQueryItem(name: "playlist", value: videoID)
                ])
            }
            guard let url = components.url else { return }
            // Configure only when playback is requested, so launching the app
            // does not interrupt audio from another app.
            do {
                let session = AVAudioSession.sharedInstance()
                try session.setCategory(.playback, mode: .moviePlayback)
                try session.setActive(true)
            } catch {
                NSLog("Unable to activate background playback audio session: %@", error.localizedDescription)
            }
            if videoWebView == nil {
                let configuration = WKWebViewConfiguration()
                configuration.allowsInlineMediaPlayback = true
                configuration.allowsPictureInPictureMediaPlayback = true
                configuration.allowsAirPlayForMediaPlayback = true
                configuration.mediaTypesRequiringUserActionForPlayback = []
                if #available(iOS 15.4, *) {
                    configuration.preferences.isElementFullscreenEnabled = true
                }
                if let scriptURL = Bundle.main.url(forResource: "ios-auto-skip", withExtension: "js", subdirectory: "public"),
                   let source = try? String(contentsOf: scriptURL, encoding: .utf8) {
                    configuration.userContentController.addUserScript(WKUserScript(source: source, injectionTime: .atDocumentEnd, forMainFrameOnly: false))
                }
                configuration.userContentController.add(pipMessageHandler, name: "youtubePiP")
                if let scriptURL = Bundle.main.url(forResource: "ios-pip", withExtension: "js", subdirectory: "public"),
                   let source = try? String(contentsOf: scriptURL, encoding: .utf8) {
                    configuration.userContentController.addUserScript(WKUserScript(source: source, injectionTime: .atDocumentEnd, forMainFrameOnly: false))
                }
                let player = WKWebView(frame: .zero, configuration: configuration)
                player.scrollView.isScrollEnabled = false
                player.isOpaque = false
                player.backgroundColor = .black
                webView.addSubview(player)
                videoWebView = player
            }
            // YouTube requires an HTTPS app identity as Referer in iOS WebViews.
            // loadHTMLString(baseURL:) provides it for the embedded iframe.
            let escapedURL = url.absoluteString.replacingOccurrences(of: "&", with: "&amp;")
            let html = """
            <!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
            <meta name="referrer" content="strict-origin-when-cross-origin">
            <style>html,body{margin:0;width:100%;height:100%;background:#000}iframe{width:100%;height:100%;border:0;display:block}</style>
            </head><body><iframe src="\(escapedURL)" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></body></html>
            """
            pipFrame = nil
            videoWebView?.loadHTMLString(html, baseURL: identity)
        }
        if let rect = body["rect"] as? [String: Double],
           let x = rect["x"], let y = rect["y"], let width = rect["width"], let height = rect["height"],
           [x, y, width, height].allSatisfy({ $0.isFinite }), width >= 0, height >= 0 {
            let insets = webView.scrollView.adjustedContentInset
            videoWebView?.frame = CGRect(x: x + insets.left, y: y + insets.top, width: width, height: height)
        }
        videoWebView?.isHidden = body["hidden"] as? Bool ?? false
    }

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        // Capacitor replaces userContentController after webViewConfiguration().
        guard let configuration = webView?.configuration else { return }
        configuration.userContentController.add(playerMessageHandler, name: "youtubePlayer")
        if let url = Bundle.main.url(forResource: "ios-auto-skip", withExtension: "js", subdirectory: "public"),
           let source = try? String(contentsOf: url, encoding: .utf8) {
            configuration.userContentController.addUserScript(WKUserScript(
                source: source,
                injectionTime: .atDocumentEnd,
                forMainFrameOnly: false
            ))
        }
    }
}

private final class YouTubeSelectionHandler: NSObject, WKScriptMessageHandler {
    weak var owner: YouTubeBrowserViewController?

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame,
              message.frameInfo.securityOrigin.protocol == "https",
              YouTubeBrowserViewController.allowedHosts.contains(message.frameInfo.securityOrigin.host),
              let value = message.body as? String, let url = URL(string: value) else { return }
        owner?.selectVideo(url)
    }
}

private final class YouTubeBrowserViewController: UIViewController, WKNavigationDelegate {
    static let allowedHosts: Set<String> = ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"]
    var onSelection: ((String) -> Void)?
    private var browser: WKWebView!
    private var didSelect = false
    private let selectionHandler = YouTubeSelectionHandler()

    override func viewDidLoad() {
        super.viewDidLoad()
        title = "YouTube"
        view.backgroundColor = .systemBackground
        navigationItem.rightBarButtonItem = UIBarButtonItem(title: "Đóng", style: .done, target: self, action: #selector(close))
        navigationItem.leftBarButtonItem = UIBarButtonItem(title: "Quay lại", style: .plain, target: self, action: #selector(goBack))
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = .all
        selectionHandler.owner = self
        configuration.userContentController.add(selectionHandler, name: "youtubeSelection")
        if let scriptURL = Bundle.main.url(forResource: "ios-youtube-browser", withExtension: "js", subdirectory: "public"),
           let source = try? String(contentsOf: scriptURL, encoding: .utf8) {
            configuration.userContentController.addUserScript(WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
        browser = WKWebView(frame: .zero, configuration: configuration)
        browser.navigationDelegate = self
        browser.allowsBackForwardNavigationGestures = true
        browser.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(browser)
        NSLayoutConstraint.activate([
            browser.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            browser.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
            browser.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            browser.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        ])
        browser.load(URLRequest(url: URL(string: "https://m.youtube.com/")!))
    }

    @objc private func close() {
        browser.stopLoading()
        browser.loadHTMLString("", baseURL: nil)
        dismiss(animated: true)
    }

    @objc private func goBack() {
        if browser.canGoBack { browser.goBack() }
    }

    @discardableResult fileprivate func selectVideo(_ url: URL) -> Bool {
        guard url.scheme == "https", let host = url.host, Self.allowedHosts.contains(host),
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return false }
        let parts = url.path.split(separator: "/")
        let candidate: String?
        if host == "youtu.be", parts.count == 1 {
            candidate = String(parts[0])
        } else if url.path == "/watch" {
            candidate = components.queryItems?.first(where: { $0.name == "v" })?.value
        } else if parts.count == 2, ["shorts", "live"].contains(String(parts[0])) {
            candidate = String(parts[1])
        } else {
            return false
        }
        guard let id = candidate, id.range(of: "^[A-Za-z0-9_-]{11}$", options: .regularExpression) != nil else { return false }
        guard !didSelect else { return true }
        didSelect = true
        browser.stopLoading()
        browser.loadHTMLString("", baseURL: nil)
        let callback = onSelection
        dismiss(animated: true) { callback?("https://www.youtube.com/watch?v=\(id)") }
        return true
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        let isMain = navigationAction.targetFrame?.isMainFrame ?? true
        if isMain && selectVideo(url) { decisionHandler(.cancel); return }
        guard ["https", "about"].contains(url.scheme ?? "") else { decisionHandler(.cancel); return }
        if navigationAction.targetFrame == nil {
            decisionHandler(.cancel)
            webView.load(navigationAction.request)
            return
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        guard (error as NSError).code != NSURLErrorCancelled, !didSelect else { return }
        let alert = UIAlertController(title: "Không tải được YouTube", message: "Kiểm tra kết nối mạng và thử lại.", preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Đóng", style: .cancel))
        alert.addAction(UIAlertAction(title: "Thử lại", style: .default) { [weak self] _ in
            self?.browser.load(URLRequest(url: URL(string: "https://m.youtube.com/")!))
        })
        if presentedViewController == nil { present(alert, animated: true) }
    }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = PlayerBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }

    func sceneWillResignActive(_ scene: UIScene) {
        // Start while the scene is still active: once iOS has fully suspended the
        // app, WebKit may reject a new PiP presentation request.
        (window?.rootViewController as? PlayerBridgeViewController)?.startPiPWhenBackgrounding()
    }

    func sceneWillEnterForeground(_ scene: UIScene) {
        (window?.rootViewController as? PlayerBridgeViewController)?.recoverPiPAfterForeground()
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        (window?.rootViewController as? PlayerBridgeViewController)?.recoverPiPAfterForeground()
    }
}
