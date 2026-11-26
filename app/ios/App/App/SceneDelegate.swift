import UIKit
import WebKit
import StoreKit
import Photos
import AVFoundation
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = YapstatsViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)

        ChatImport.removeLeftovers()
        importChat(from: connectionOptions.urlContexts)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        if importChat(from: URLContexts) { return }
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }

    // MARK: - Startup animation every time the app is opened

    /// Blurs the app while it is in the background: the app switcher shows a teaser, never a readable chat, and the return starts clean.
    private var cover: UIView?
    private var recapOpen = false

    /// Fires as the swipe to the app switcher begins, while the page can still answer.
    func sceneWillResignActive(_ scene: UIScene) {
        let webView = (window?.rootViewController as? CAPBridgeViewController)?.webView
        webView?.evaluateJavaScript("!document.getElementById('result').hidden") { [weak self] open, _ in
            self?.recapOpen = open as? Bool ?? false // pages without a recap answer with an error
        }
    }

    func sceneDidEnterBackground(_ scene: UIScene) {
        guard cover == nil, let window else { return }
        let blur = UIVisualEffectView(effect: UIBlurEffect(style: .systemThinMaterial))
        blur.frame = window.bounds
        blur.autoresizingMask = [.flexibleWidth, .flexibleHeight]

        let eye = UIImageView(image: UIImage(systemName: "eye.slash.fill", withConfiguration: UIImage.SymbolConfiguration(pointSize: 34, weight: .semibold)))
        eye.tintColor = .label
        let title = UILabel()
        title.text = "No peeking"
        title.font = .systemFont(ofSize: 32, weight: .heavy)
        let line = UILabel()
        line.text = recapOpen ? "Your cards are waiting for you." : "Open Yapstats to make your recap."
        line.font = .systemFont(ofSize: 16, weight: .medium)
        line.textColor = .secondaryLabel
        line.textAlignment = .center
        line.numberOfLines = 0

        let stack = UIStackView(arrangedSubviews: [eye, title, line])
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 8
        stack.setCustomSpacing(14, after: eye)
        stack.translatesAutoresizingMaskIntoConstraints = false
        blur.contentView.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.centerXAnchor.constraint(equalTo: blur.contentView.centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: blur.contentView.centerYAnchor),
            stack.widthAnchor.constraint(lessThanOrEqualTo: blur.contentView.widthAnchor, constant: -64),
        ])
        window.addSubview(blur)
        cover = blur
    }

    /// Coming back from the background: the page plays its startup animation and sound again, then the cover lifts.
    func sceneWillEnterForeground(_ scene: UIScene) {
        guard let cover else { return } // the first launch plays its own
        self.cover = nil
        let lift = { UIView.animate(withDuration: 0.12, animations: { cover.alpha = 0 }, completion: { _ in cover.removeFromSuperview() }) }
        guard let webView = (window?.rootViewController as? CAPBridgeViewController)?.webView else { lift(); return }
        var lifted = false
        let liftOnce = { if !lifted { lifted = true; lift() } }
        webView.callAsyncJavaScript("window.yapstatsIntro?.(); return true;", arguments: [:], in: nil, in: .page) { _ in liftOnce() }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6, execute: liftOnce) // never leave the cover up if the page does not answer
    }

    // MARK: - Chat export opened from another app's share sheet

    /// Takes the first chat export in `contexts` and hands it to the page. Returns true if one was found.
    @discardableResult
    private func importChat(from contexts: Set<UIOpenURLContext>) -> Bool {
        guard let url = contexts.map({ $0.url }).first(where: ChatImport.accepts),
              let copy = ChatImport.privateCopy(of: url) else { return false }
        deliver(copy, attempt: 0)
        return true
    }

    /// Runs the hand-off script until the page is ready (it may still be loading on a cold start),
    /// then deletes the private copy. The page keeps the chat in memory only, as on the website.
    private func deliver(_ copy: URL, attempt: Int) {
        let retry = { [weak self] in
            guard attempt < 60 else { ChatImport.remove(copy); return }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { self?.deliver(copy, attempt: attempt + 1) }
        }
        guard let webView = (window?.rootViewController as? CAPBridgeViewController)?.webView else { retry(); return }

        let arguments: [String: Any] = [
            "path": copy.path,
            "name": copy.lastPathComponent,
            "type": ChatImport.mimeType(of: copy)
        ]
        webView.callAsyncJavaScript(ChatImport.handOffScript, arguments: arguments, in: nil, in: .page) { result in
            if case .success(let value) = result, let status = value as? String, status != "wait" {
                ChatImport.remove(copy)
            } else {
                retry()
            }
        }
    }
}

/// The app's web view. Same as Capacitor's, except that sub-pages get their own files.
final class YapstatsViewController: CAPBridgeViewController {
    override func router() -> Router { FolderRouter() }

    override func capacitorDidLoad() {
        // Same colour as the launch screen and the page, so launch, status bar and overscroll never flash.
        let background = UIColor(named: "LaunchBackground") ?? .systemBackground
        view.backgroundColor = background
        webView?.isOpaque = false
        webView?.backgroundColor = background
        webView?.scrollView.backgroundColor = background
        // Every page, About, Privacy and Terms included, knows it is in the app before it first draws.
        webView?.configuration.userContentController.addUserScript(WKUserScript(
            source: "document.documentElement.classList.add('is-app')", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        // The page reaches native features with window.webkit.messageHandlers.yapstats.postMessage({ type }).
        webView?.configuration.userContentController.add(self, name: "yapstats")
        if let scroll = webView?.scrollView {
            // While the page loads its height changes, and WebKit can leave it resting under the status bar (seen on iOS 27:
            // offset 0 where the top limit is -62). A page that fits the screen cannot be dragged back, so a resting
            // position outside the limits is put back inside them.
            scrollWatch = [
                scroll.observe(\.contentSize) { scroll, _ in YapstatsViewController.settle(scroll) },
                scroll.observe(\.contentOffset) { scroll, _ in YapstatsViewController.settle(scroll) }
            ]
        }
        // Purchases that finish outside a buy tap (Ask to Buy approvals, refunds, another device) arrive here.
        purchaseUpdates = Task { [weak self] in
            for await update in Transaction.updates {
                if case .verified(let transaction) = update { await transaction.finish() }
                await self?.reportPurchase()
            }
        }
    }

    private var purchaseUpdates: Task<Void, Never>?
    private var scrollWatch: [NSKeyValueObservation] = []
    private var startupSound: AVAudioPlayer? // used on audioQueue only
    private let audioQueue = DispatchQueue(label: "tech.yapstats.app.audio", qos: .userInitiated)

    /// One quiet chime with the startup animation, each time the animation plays. It follows the silent switch and
    /// never interrupts or talks over other audio. Audio work stays off the main thread: those calls can stall the UI.
    private func playStartupSound() {
        guard let url = Bundle.main.url(forResource: "startup", withExtension: "m4a") else { return }
        audioQueue.async { [weak self] in
            guard let self else { return }
            let session = AVAudioSession.sharedInstance()
            guard !session.isOtherAudioPlaying else { return }
            if self.startupSound == nil {
                try? session.setCategory(.ambient)
                self.startupSound = try? AVAudioPlayer(contentsOf: url)
                self.startupSound?.volume = 0.7
            }
            self.startupSound?.currentTime = 0 // from the top if the last one is still ringing
            self.startupSound?.play()
        }
    }

    /// Saves one card (PNG, base64 from the page) to Photos. Asks for add-only access the first time: the app never reads the library.
    private func saveToPhotos(base64: String) {
        guard let data = Data(base64Encoded: base64), UIImage(data: data) != nil else {
            reportSaved(error: "Couldn’t read that card. Try again.")
            return
        }
        PHPhotoLibrary.requestAuthorization(for: .addOnly) { [weak self] status in
            guard status == .authorized || status == .limited else {
                self?.reportSaved(error: "Yapstats can’t add to Photos. Allow it in Settings, under Yapstats, then Photos.")
                return
            }
            PHPhotoLibrary.shared().performChanges({
                PHAssetCreationRequest.forAsset().addResource(with: .photo, data: data, options: nil) // the PNG as it is, not re-compressed
            }, completionHandler: { saved, _ in
                self?.reportSaved(error: saved ? nil : "Couldn’t save that card. Try again.")
            })
        }
    }

    private func reportSaved(error: String?) {
        DispatchQueue.main.async { [weak self] in
            if error == nil { UINotificationFeedbackGenerator().notificationOccurred(.success) }
            var state: [String: Any] = ["ok": error == nil]
            if let error { state["error"] = error }
            self?.webView?.callAsyncJavaScript("window.yapstatsSaved?.(state); return true;", arguments: ["state": state], in: nil, in: .page, completionHandler: nil)
        }
    }

    private static func restingOffset(for scroll: UIScrollView) -> CGFloat? {
        guard !scroll.isTracking, !scroll.isDecelerating, !scroll.isZooming else { return nil } // a finger or a bounce may pass the limits
        let top = -scroll.adjustedContentInset.top
        let bottom = max(top, scroll.contentSize.height - scroll.bounds.height + scroll.adjustedContentInset.bottom)
        let inside = min(max(scroll.contentOffset.y, top), bottom)
        return abs(inside - scroll.contentOffset.y) > 0.5 ? inside : nil
    }

    private static func settle(_ scroll: UIScrollView) {
        guard restingOffset(for: scroll) != nil else { return }
        DispatchQueue.main.async { // after WebKit has finished its own update
            if let inside = restingOffset(for: scroll) { scroll.contentOffset.y = inside }
        }
    }

    /// Tells the page whether the full recap is owned and what it costs in the buyer's currency, plus a message if something went wrong.
    private func reportPurchase(message: String? = nil) async {
        let owned = await FullRecap.isOwned()
        let price = await FullRecap.product()?.displayPrice
        var state: [String: Any] = ["owned": owned]
        if let price { state["price"] = price }
        if let message { state["error"] = message }
        _ = try? await webView?.callAsyncJavaScript("window.yapstatsPurchase?.(state); return true;", arguments: ["state": state], in: nil, contentWorld: .page)
    }

    private func buy() async {
        guard let product = await FullRecap.product() else {
            await reportPurchase(message: "The full recap isn’t available right now. Try again later.")
            return
        }
        do {
            switch try await product.purchase() {
            case .success(.verified(let transaction)):
                await transaction.finish()
                UINotificationFeedbackGenerator().notificationOccurred(.success)
                await reportPurchase()
            case .success(.unverified):
                await reportPurchase(message: "Apple couldn’t verify that purchase. You haven’t been charged.")
            case .pending:
                await reportPurchase(message: "Waiting for approval. The full recap unlocks as soon as it’s approved.")
            case .userCancelled:
                await reportPurchase()
            @unknown default:
                await reportPurchase()
            }
        } catch {
            await reportPurchase(message: "The purchase didn’t go through. You haven’t been charged.")
        }
    }

    private func restore() async {
        do {
            try await AppStore.sync()
        } catch {
            await reportPurchase(message: "Couldn’t check with the App Store. Try again.")
            return
        }
        let owned = await FullRecap.isOwned()
        await reportPurchase(message: owned ? nil : "No full recap purchase found for this Apple Account.")
    }
}

/// The one thing for sale: the full recap, bought once. StoreKit checks the signed transaction on the device.
private enum FullRecap {
    static let productID = "tech.yapstats.app.fullrecap"

    static func product() async -> Product? {
        try? await Product.products(for: [productID]).first
    }

    static func isOwned() async -> Bool {
        for await entitlement in Transaction.currentEntitlements {
            if case .verified(let transaction) = entitlement, transaction.productID == productID, transaction.revocationDate == nil {
                return true
            }
        }
        return false
    }
}

extension YapstatsViewController: WKScriptMessageHandler {
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame,
              let body = message.body as? [String: Any],
              let type = body["type"] as? String else { return }
        switch type {
        case "tick": UIImpactFeedbackGenerator(style: .light).impactOccurred()
        case "success": UINotificationFeedbackGenerator().notificationOccurred(.success)
        case "intro": playStartupSound()
        case "save": saveToPhotos(base64: body["data"] as? String ?? "")
        case "buy": Task { await buy() }
        case "restore": Task { await restore() }
        case "purchase": Task { await reportPurchase() }
        default: break
        }
    }
}

/// Capacitor treats every path without a file extension as a single-page-app route and serves the
/// home page. Yapstats has real sub-pages (/privacy/, /terms/, the export guides), so serve each
/// folder's own index.html and fall back to the home page only when there is none.
private struct FolderRouter: Router {
    var basePath = ""

    func route(for path: String) -> String {
        guard URL(fileURLWithPath: path).pathExtension.isEmpty else { return basePath + path }
        let page = basePath + (path.hasSuffix("/") ? path : path + "/") + "index.html"
        return FileManager.default.fileExists(atPath: page) ? page : basePath + "/index.html"
    }
}

/// A chat export shared into the app ("Open in Yapstats"). The file never leaves the device:
/// it is moved to a private temporary folder, read once by the bundled page, then deleted.
private enum ChatImport {
    private static let mimeTypes = ["zip": "application/zip", "txt": "text/plain", "json": "application/json"]
    private static let folder = FileManager.default.temporaryDirectory.appendingPathComponent("chat-import", isDirectory: true)

    static func accepts(_ url: URL) -> Bool {
        url.isFileURL && mimeTypes[url.pathExtension.lowercased()] != nil
    }

    static func mimeType(of url: URL) -> String {
        mimeTypes[url.pathExtension.lowercased()] ?? "application/octet-stream"
    }

    /// Moves (or copies, for a file outside the app) the export into the private import folder.
    static func privateCopy(of url: URL) -> URL? {
        let files = FileManager.default
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }

        try? files.removeItem(at: folder)
        do {
            try files.createDirectory(at: folder, withIntermediateDirectories: true)
            let copy = folder.appendingPathComponent(url.lastPathComponent)
            if url.deletingLastPathComponent().lastPathComponent == "Inbox" {
                try files.moveItem(at: url, to: copy)
            } else {
                try files.copyItem(at: url, to: copy)
            }
            return copy
        } catch {
            return nil
        }
    }

    static func remove(_ copy: URL) {
        try? FileManager.default.removeItem(at: copy)
    }

    /// Deletes anything a previous run left behind, including the system's Documents/Inbox copies.
    static func removeLeftovers() {
        let files = FileManager.default
        try? files.removeItem(at: folder)
        if let documents = files.urls(for: .documentDirectory, in: .userDomainMask).first {
            try? files.removeItem(at: documents.appendingPathComponent("Inbox", isDirectory: true))
        }
    }

    /// Body of an async function with `path`, `name` and `type` in scope. Puts the export into the page's
    /// own file input, so the page handles it exactly like a file picked by hand.
    /// Returns "wait" until the page is ready, then "ok" or "unreadable".
    static let handOffScript = #"""
        const input = document.getElementById('file');
        const landing = document.getElementById('landing');
        if (document.readyState !== 'complete' || !input || !landing || !window.Capacitor) return 'wait';
        if (landing.hidden) {
            if (!window.yapstatsRestarting) { window.yapstatsRestarting = true; location.reload(); }
            return 'wait';
        }
        const response = await fetch(window.Capacitor.convertFileSrc(path)).catch(() => null);
        if (!response || !response.ok) return 'unreadable';
        const file = new File([await response.blob()], name, { type });
        const transfer = new DataTransfer();
        transfer.items.add(file);
        input.files = transfer.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return 'ok';
        """#
}
