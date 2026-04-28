import Foundation
import Capacitor
import AVFoundation
import UIKit

/// Native AVFoundation-based QR scanner for Capacitor 8.
/// Replaces @capacitor-mlkit/barcode-scanning on iOS, which is CocoaPods-only
/// and pulls in ~50 MB of Google MLKit. AVFoundation has shipped QR detection
/// since iOS 7 and is more than enough for the Nextcloud-setup QR use case.
///
/// JS API (see src/utils/nextcloudQrScanner.ts):
///   isSupported()        -> { supported: boolean }
///   checkPermissions()   -> { camera: 'granted'|'denied'|'prompt'|'restricted' }
///   requestPermissions() -> { camera: 'granted'|'denied'|'prompt'|'restricted' }
///   scan()               -> { rawValue: string | null, cancelled: boolean }
@objc(OwnJournalQrScannerPlugin)
public class OwnJournalQrScannerPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "OwnJournalQrScannerPlugin"
    public let jsName = "OwnJournalQrScanner"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isSupported", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "checkPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "scan", returnType: CAPPluginReturnPromise),
    ]

    @objc func isSupported(_ call: CAPPluginCall) {
        // Simulator has no camera — return false so the JS layer can hide the QR button.
        let supported = AVCaptureDevice.default(for: .video) != nil
        call.resolve(["supported": supported])
    }

    @objc override public func checkPermissions(_ call: CAPPluginCall) {
        call.resolve(["camera": Self.permissionString(for: AVCaptureDevice.authorizationStatus(for: .video))])
    }

    @objc override public func requestPermissions(_ call: CAPPluginCall) {
        let current = AVCaptureDevice.authorizationStatus(for: .video)
        if current == .notDetermined {
            AVCaptureDevice.requestAccess(for: .video) { _ in
                let after = AVCaptureDevice.authorizationStatus(for: .video)
                call.resolve(["camera": Self.permissionString(for: after)])
            }
        } else {
            call.resolve(["camera": Self.permissionString(for: current)])
        }
    }

    @objc func scan(_ call: CAPPluginCall) {
        guard AVCaptureDevice.authorizationStatus(for: .video) == .authorized else {
            call.reject("Camera permission not granted")
            return
        }
        guard AVCaptureDevice.default(for: .video) != nil else {
            call.reject("Camera is not available on this device")
            return
        }

        bridge?.saveCall(call)

        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            guard let presenter = Self.topViewController() else {
                if let saved = self.bridge?.savedCall(withID: call.callbackId) {
                    saved.reject("Could not find a view controller to present from")
                    self.bridge?.releaseCall(saved)
                }
                return
            }

            let scanner = QrScannerViewController()
            scanner.modalPresentationStyle = .fullScreen
            scanner.onResult = { [weak self] rawValue, cancelled in
                guard let self = self else { return }
                presenter.dismiss(animated: true) {
                    guard let saved = self.bridge?.savedCall(withID: call.callbackId) else { return }
                    saved.resolve([
                        "rawValue": rawValue as Any? ?? NSNull(),
                        "cancelled": cancelled,
                    ])
                    self.bridge?.releaseCall(saved)
                }
            }
            presenter.present(scanner, animated: true)
        }
    }

    private static func permissionString(for status: AVAuthorizationStatus) -> String {
        switch status {
        case .authorized: return "granted"
        case .denied: return "denied"
        case .restricted: return "restricted"
        case .notDetermined: return "prompt"
        @unknown default: return "prompt"
        }
    }

    private static func topViewController() -> UIViewController? {
        let scene = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first(where: { $0.activationState == .foregroundActive })
            ?? UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first
        let keyWindow = scene?.windows.first(where: { $0.isKeyWindow }) ?? scene?.windows.first
        var top = keyWindow?.rootViewController
        while let presented = top?.presentedViewController {
            top = presented
        }
        return top
    }
}

/// Fullscreen camera preview with QR detection. Calls onResult exactly once,
/// either with the decoded string or with cancelled=true.
private final class QrScannerViewController: UIViewController, AVCaptureMetadataOutputObjectsDelegate {
    var onResult: ((String?, Bool) -> Void)?

    private let session = AVCaptureSession()
    private var previewLayer: AVCaptureVideoPreviewLayer?
    private let sessionQueue = DispatchQueue(label: "app.ownjournal.qrscanner.session")
    private var didFinish = false

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black

        configureSession()
        addPreview()
        addCancelButton()
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        sessionQueue.async { [weak self] in
            guard let self = self, !self.session.isRunning else { return }
            self.session.startRunning()
        }
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        sessionQueue.async { [weak self] in
            guard let self = self, self.session.isRunning else { return }
            self.session.stopRunning()
        }
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        previewLayer?.frame = view.bounds
    }

    override var prefersStatusBarHidden: Bool { true }

    private func configureSession() {
        guard let device = AVCaptureDevice.default(for: .video),
              let input = try? AVCaptureDeviceInput(device: device) else {
            return
        }
        session.beginConfiguration()
        if session.canAddInput(input) {
            session.addInput(input)
        }
        let output = AVCaptureMetadataOutput()
        if session.canAddOutput(output) {
            session.addOutput(output)
            output.setMetadataObjectsDelegate(self, queue: .main)
            if output.availableMetadataObjectTypes.contains(.qr) {
                output.metadataObjectTypes = [.qr]
            }
        }
        session.commitConfiguration()
    }

    private func addPreview() {
        let layer = AVCaptureVideoPreviewLayer(session: session)
        layer.videoGravity = .resizeAspectFill
        layer.frame = view.bounds
        view.layer.addSublayer(layer)
        previewLayer = layer
    }

    private func addCancelButton() {
        let button = UIButton(type: .system)
        button.setTitle(NSLocalizedString("Cancel", comment: ""), for: .normal)
        button.setTitleColor(.white, for: .normal)
        button.titleLabel?.font = .systemFont(ofSize: 17, weight: .semibold)
        button.backgroundColor = UIColor.black.withAlphaComponent(0.5)
        button.layer.cornerRadius = 18
        button.contentEdgeInsets = UIEdgeInsets(top: 8, left: 16, bottom: 8, right: 16)
        button.translatesAutoresizingMaskIntoConstraints = false
        button.addTarget(self, action: #selector(cancelTapped), for: .touchUpInside)
        view.addSubview(button)
        NSLayoutConstraint.activate([
            button.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 16),
            button.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 12),
        ])
    }

    @objc private func cancelTapped() {
        finish(rawValue: nil, cancelled: true)
    }

    func metadataOutput(_ output: AVCaptureMetadataOutput,
                        didOutput metadataObjects: [AVMetadataObject],
                        from connection: AVCaptureConnection) {
        guard let object = metadataObjects.first as? AVMetadataMachineReadableCodeObject,
              object.type == .qr,
              let value = object.stringValue else {
            return
        }
        finish(rawValue: value, cancelled: false)
    }

    private func finish(rawValue: String?, cancelled: Bool) {
        guard !didFinish else { return }
        didFinish = true
        sessionQueue.async { [weak self] in
            self?.session.stopRunning()
        }
        onResult?(rawValue, cancelled)
    }
}
