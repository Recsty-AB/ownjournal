import Foundation
import Capacitor
import AuthenticationServices

/// Native Apple Sign-In plugin for Capacitor 8.
/// Replaces @capacitor-community/apple-sign-in which only supports Capacitor 7.
@objc(AppleSignInPlugin)
public class AppleSignInPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppleSignInPlugin"
    public let jsName = "SignInWithApple"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "authorize", returnType: CAPPluginReturnPromise),
    ]

    @objc func authorize(_ call: CAPPluginCall) {
        let provider = ASAuthorizationAppleIDProvider()
        let request = provider.createRequest()

        var scopes: [ASAuthorization.Scope] = []
        if let scopesStr = call.getString("scopes") {
            if scopesStr.contains("name") { scopes.append(.fullName) }
            if scopesStr.contains("email") { scopes.append(.email) }
        }
        if !scopes.isEmpty { request.requestedScopes = scopes }
        request.state = call.getString("state")
        request.nonce = call.getString("nonce")

        self.bridge?.saveCall(call)

        let delegate = AppleSignInDelegate(plugin: self, callbackId: call.callbackId)
        objc_setAssociatedObject(self, "delegate", delegate, .OBJC_ASSOCIATION_RETAIN)

        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = delegate
        DispatchQueue.main.async {
            controller.performRequests()
        }
    }
}

private class AppleSignInDelegate: NSObject, ASAuthorizationControllerDelegate {
    let plugin: CAPPlugin
    let callbackId: String

    init(plugin: CAPPlugin, callbackId: String) {
        self.plugin = plugin
        self.callbackId = callbackId
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let call = plugin.bridge?.savedCall(withID: callbackId) else { return }

        var response: [String: Any?] = [
            "user": credential.user,
            "email": credential.email,
            "givenName": credential.fullName?.givenName,
            "familyName": credential.fullName?.familyName,
        ]
        if let token = credential.identityToken {
            response["identityToken"] = String(data: token, encoding: .utf8)
        }
        if let code = credential.authorizationCode {
            response["authorizationCode"] = String(data: code, encoding: .utf8)
        }

        call.resolve(["response": response])
        plugin.bridge?.releaseCall(call)
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        guard let call = plugin.bridge?.savedCall(withID: callbackId) else { return }
        call.reject(error.localizedDescription)
        plugin.bridge?.releaseCall(call)
    }
}
