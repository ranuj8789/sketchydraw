package com.sketchydraw.auth.service;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.sketchydraw.auth.dto.*;
import com.sketchydraw.auth.entity.User;
import com.sketchydraw.auth.repository.UserRepository;
import com.sketchydraw.auth.util.JwtUtil;
import com.sketchydraw.auth.util.PasswordUtil;
import com.sketchydraw.auth.util.TokenUtil;
import com.sketchydraw.email.EmailUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Collections;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final EmailUtil emailUtil;
    private final JwtUtil jwtUtil;

    @Value("${app.frontend.base-url:http://localhost:3000}")
    private String frontendBaseUrl;

    @Value("${app.google.client-id}")
    private String googleClientId;

    @Value("${app.auth.verification-token-expiry-minutes:60}")
    private long verificationTokenExpiryMinutes;

    @Value("${app.auth.reset-token-expiry-minutes:30}")
    private long resetTokenExpiryMinutes;

    public AuthResponse register(RegisterRequest request) {
        validateRegisterRequest(request);

        String email = normalizeEmail(request.getEmail());

        if (userRepository.findByEmail(email).isPresent()) {
            throw new IllegalArgumentException("User already exists with this email");
        }

        User user = new User();
        user.setFullName(request.getFullName().trim());
        user.setEmail(email);
        user.setPasswordHash(PasswordUtil.hash(request.getPassword()));
        user.setVerificationToken(TokenUtil.randomToken());
        user.setVerificationTokenCreatedAt(LocalDateTime.now());
        user.setCreatedAt(LocalDateTime.now());
        user.setEmailVerified(false);

        userRepository.save(user);

        sendVerificationEmail(user);

        return new AuthResponse(
                true,
                "User registered successfully. Verification email sent.",
                user.getEmail(),
                user.getFullName(),
                null
        );
    }

    public AuthResponse verifyEmail(String token) {
        if (token == null || token.isBlank()) {
            throw new IllegalArgumentException("Invalid verification token");
        }

        User user = userRepository.findByVerificationToken(token)
                .orElseThrow(() -> new IllegalArgumentException("Invalid or expired verification token"));

        if (user.isEmailVerified()) {
            return AuthResponse.builder()
                    .message("Email already verified. You can now login.")
                    .email(user.getEmail())
                    .fullName(user.getFullName())
                    .build();
        }

        user.setEmailVerified(true);

        // IMPORTANT:
        // Do NOT clear verificationToken immediately.
        // React dev mode can call verify twice.
        // Keeping token makes second call return success instead of 400.
        //
        // user.setVerificationToken(null);  // keep this commented for now

        userRepository.save(user);

        return AuthResponse.builder()
                .message("Email verified successfully. You can now login.")
                .email(user.getEmail())
                .fullName(user.getFullName())
                .build();
    }

    public AuthResponse login(LoginRequest request) {
        if (request.getEmail() == null || request.getEmail().isBlank()) {
            throw new IllegalArgumentException("Email is required");
        }

        if (request.getPassword() == null || request.getPassword().isBlank()) {
            throw new IllegalArgumentException("Password is required");
        }

        String email = normalizeEmail(request.getEmail());

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("Invalid email or password"));

        if (!PasswordUtil.matches(request.getPassword(), user.getPasswordHash())) {
            throw new IllegalArgumentException("Invalid email or password");
        }

        if (!user.isEmailVerified()) {
            throw new IllegalArgumentException("Please verify your email first");
        }

        String jwt = jwtUtil.generateToken(user.getId(), user.getEmail());

        return new AuthResponse(
                true,
                "Login successful",
                user.getEmail(),
                user.getFullName(),
                jwt
        );
    }

    public AuthResponse forgotPassword(ForgotPasswordRequest request) {
        if (request.getEmail() == null || request.getEmail().isBlank()) {
            throw new IllegalArgumentException("Email is required");
        }

        String email = normalizeEmail(request.getEmail());

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found with this email"));

        user.setResetToken(TokenUtil.randomToken());
        user.setResetTokenCreatedAt(LocalDateTime.now());

        userRepository.save(user);

        sendResetPasswordEmail(user);

        return new AuthResponse(
                true,
                "Reset password email sent successfully",
                user.getEmail(),
                user.getFullName(),
                null
        );
    }

    public AuthResponse resetPassword(ResetPasswordRequest request) {
        if (request.getToken() == null || request.getToken().isBlank()) {
            throw new IllegalArgumentException("Reset token is required");
        }

        if (request.getNewPassword() == null || request.getNewPassword().isBlank()) {
            throw new IllegalArgumentException("New password is required");
        }

        User user = userRepository.findByResetToken(request.getToken())
                .orElseThrow(() -> new IllegalArgumentException("Invalid reset token"));

        if (user.getResetTokenCreatedAt() == null) {
            throw new IllegalArgumentException("Reset token is invalid");
        }

        LocalDateTime expiryTime = user.getResetTokenCreatedAt()
                .plusMinutes(resetTokenExpiryMinutes);

        if (expiryTime.isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("Reset token has expired. Please request a new reset email.");
        }

        user.setPasswordHash(PasswordUtil.hash(request.getNewPassword()));
        user.setResetToken(null);
        user.setResetTokenCreatedAt(null);

        userRepository.save(user);

        return new AuthResponse(
                true,
                "Password reset successful",
                user.getEmail(),
                user.getFullName(),
                null
        );
    }

    public AuthResponse resendVerificationEmail(ResendVerificationRequest request) {
        if (request.getEmail() == null || request.getEmail().isBlank()) {
            throw new IllegalArgumentException("Email is required");
        }

        String email = normalizeEmail(request.getEmail());

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found with this email"));

        if (user.isEmailVerified()) {
            throw new IllegalArgumentException("Email is already verified");
        }

        user.setVerificationToken(TokenUtil.randomToken());
        user.setVerificationTokenCreatedAt(LocalDateTime.now());

        userRepository.save(user);

        sendVerificationEmail(user);

        return new AuthResponse(
                true,
                "Verification email resent successfully",
                user.getEmail(),
                user.getFullName(),
                null
        );
    }

    private void sendVerificationEmail(User user) {
        String token = encode(user.getVerificationToken());
        String verificationLink = frontendBaseUrl + "/verify?token=" + token;

        String html = """
                <html>
                    <body style="font-family: Arial, sans-serif; color: #222;">
                        <div style="max-width: 600px; margin: auto; padding: 24px; border: 1px solid #eee; border-radius: 12px;">
                            <h2 style="margin-top: 0;">Verify your SketchyDraw account</h2>

                            <p>Hello %s,</p>

                            <p>Click the button below to verify your email address.</p>

                            <p style="margin: 28px 0;">
                                <a href="%s"
                                   style="background: #2563eb; color: white; padding: 12px 18px; text-decoration: none; border-radius: 8px; display: inline-block;">
                                    Verify Account
                                </a>
                            </p>

                            <p>If the button does not work, copy and paste this link into your browser:</p>

                            <p style="word-break: break-all; color: #2563eb;">%s</p>

                            <p>This link will expire in %s minutes.</p>

                            <hr style="border: none; border-top: 1px solid #eee;" />

                            <p style="font-size: 12px; color: #777;">
                                If you did not create this account, you can ignore this email.
                            </p>
                        </div>
                    </body>
                </html>
                """.formatted(
                escape(user.getFullName()),
                verificationLink,
                verificationLink,
                verificationTokenExpiryMinutes
        );

        emailUtil.sendHtmlEmail(
                user.getEmail(),
                "Verify your account",
                html
        );
    }

    private void sendResetPasswordEmail(User user) {
        String token = encode(user.getResetToken());
        String resetLink = frontendBaseUrl + "/reset-password?token=" + token;

        String html = """
                <html>
                    <body style="font-family: Arial, sans-serif; color: #222;">
                        <div style="max-width: 600px; margin: auto; padding: 24px; border: 1px solid #eee; border-radius: 12px;">
                            <h2 style="margin-top: 0;">Reset your SketchyDraw password</h2>

                            <p>Hello %s,</p>

                            <p>Click the button below to reset your password.</p>

                            <p style="margin: 28px 0;">
                                <a href="%s"
                                   style="background: #dc2626; color: white; padding: 12px 18px; text-decoration: none; border-radius: 8px; display: inline-block;">
                                    Reset Password
                                </a>
                            </p>

                            <p>If the button does not work, copy and paste this link into your browser:</p>

                            <p style="word-break: break-all; color: #dc2626;">%s</p>

                            <p>This link will expire in %s minutes.</p>

                            <hr style="border: none; border-top: 1px solid #eee;" />

                            <p style="font-size: 12px; color: #777;">
                                If you did not request this password reset, you can ignore this email.
                            </p>
                        </div>
                    </body>
                </html>
                """.formatted(
                escape(user.getFullName()),
                resetLink,
                resetLink,
                resetTokenExpiryMinutes
        );

        emailUtil.sendHtmlEmail(
                user.getEmail(),
                "Reset your password",
                html
        );
    }

    private void validateRegisterRequest(RegisterRequest request) {
        if (request.getEmail() == null || request.getEmail().isBlank()) {
            throw new IllegalArgumentException("Email is required");
        }

        if (request.getPassword() == null || request.getPassword().isBlank()) {
            throw new IllegalArgumentException("Password is required");
        }

        if (request.getFullName() == null || request.getFullName().isBlank()) {
            throw new IllegalArgumentException("Full name is required");
        }
    }

    private String normalizeEmail(String email) {
        return email.trim().toLowerCase();
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private String escape(String value) {
        if (value == null) {
            return "";
        }

        return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }
    public AuthResponse googleLogin(GoogleLoginRequest request) {
        if (request.getCredential() == null || request.getCredential().isBlank()) {
            throw new IllegalArgumentException("Google credential is required");
        }

        GoogleIdToken.Payload payload = verifyGoogleCredential(request.getCredential());

        String email = normalizeEmail(payload.getEmail());
        String googleUserId = payload.getSubject();

        String fullName = payload.get("name") == null
                ? email
                : String.valueOf(payload.get("name"));

        String pictureUrl = payload.get("picture") == null
                ? null
                : String.valueOf(payload.get("picture"));

        User user = userRepository
                .findByProviderAndProviderUserId("GOOGLE", googleUserId)
                .orElse(null);

        if (user == null) {
            user = userRepository.findByEmail(email).orElse(null);
        }

        if (user == null) {
            user = new User();
            user.setEmail(email);
            user.setFullName(fullName);
            user.setPasswordHash(PasswordUtil.hash(TokenUtil.randomToken()));
            user.setEmailVerified(true);
            user.setProvider("GOOGLE");
            user.setProviderUserId(googleUserId);
            user.setProfilePictureUrl(pictureUrl);
            user.setLastLoginAt(LocalDateTime.now());
            user.setCreatedAt(LocalDateTime.now());

            userRepository.save(user);


        } else {
            user.setEmailVerified(true);
            user.setVerificationToken(null);
            user.setVerificationTokenCreatedAt(null);
            user.setProvider("GOOGLE");
            user.setProviderUserId(googleUserId);
            user.setProfilePictureUrl(pictureUrl);
            user.setLastLoginAt(LocalDateTime.now());

            userRepository.save(user);

        }

        String jwt = jwtUtil.generateToken(user.getId(), user.getEmail());

        return new AuthResponse(
                true,
                "Google login successful",
                user.getEmail(),
                user.getFullName(),
                jwt
        );
    }

    private GoogleIdToken.Payload verifyGoogleCredential(String credential) {
        try {
            GoogleIdTokenVerifier verifier = new GoogleIdTokenVerifier.Builder(
                    new NetHttpTransport(),
                    GsonFactory.getDefaultInstance()
            )
                    .setAudience(Collections.singletonList(googleClientId))
                    .build();

            GoogleIdToken idToken = verifier.verify(credential);

            if (idToken == null) {
                throw new IllegalArgumentException("Invalid Google credential");
            }

            GoogleIdToken.Payload payload = idToken.getPayload();

            if (!Boolean.TRUE.equals(payload.getEmailVerified())) {
                throw new IllegalArgumentException("Google email is not verified");
            }

            return payload;
        } catch (IllegalArgumentException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new IllegalArgumentException("Google login failed");
        }
    }
}