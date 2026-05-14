package com.sketchydraw.email;

import jakarta.mail.*;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Properties;

@Component
public class EmailUtil {

    @Value("${app.mail.host}")
    private String host;

    @Value("${app.mail.port}")
    private String port;

    @Value("${app.mail.username}")
    private String username;

    @Value("${app.mail.password}")
    private String password;

    @Value("${app.mail.from}")
    private String from;

    @Value("${app.mail.auth:true}")
    private boolean auth;

    @Value("${app.mail.starttls.enable:true}")
    private boolean startTlsEnabled;

    @Value("${app.mail.ssl.enable:false}")
    private boolean sslEnabled;

    public void sendEmail(String to, String subject, String body) {
        try {
            Session session = Session.getInstance(buildProperties(), new Authenticator() {
                @Override
                protected PasswordAuthentication getPasswordAuthentication() {
                    return new PasswordAuthentication(username, password);
                }
            });

            Message message = new MimeMessage(session);
            message.setFrom(new InternetAddress(from));
            message.setRecipients(Message.RecipientType.TO, InternetAddress.parse(to));
            message.setSubject(subject);
            message.setText(body);

            Transport.send(message);
        } catch (Exception e) {
            throw new RuntimeException("Failed to send email", e);
        }
    }

    public void sendHtmlEmail(String to, String subject, String htmlBody) {
        try {
            Session session = Session.getInstance(buildProperties(), new Authenticator() {
                @Override
                protected PasswordAuthentication getPasswordAuthentication() {
                    return new PasswordAuthentication(username, password);
                }
            });

            MimeMessage message = new MimeMessage(session);
            message.setFrom(new InternetAddress(from));
            message.setRecipients(Message.RecipientType.TO, InternetAddress.parse(to));
            message.setSubject(subject);
            message.setContent(htmlBody, "text/html; charset=UTF-8");

            Transport.send(message);
        } catch (Exception e) {
            throw new RuntimeException("Failed to send HTML email", e);
        }
    }

    private Properties buildProperties() {
        Properties props = new Properties();
        props.put("mail.smtp.host", host);
        props.put("mail.smtp.port", port);
        props.put("mail.smtp.auth", String.valueOf(auth));
        props.put("mail.smtp.starttls.enable", String.valueOf(startTlsEnabled));
        props.put("mail.smtp.ssl.enable", String.valueOf(sslEnabled));
        return props;
    }
    public void testConnection() {
        try {
            Session session = Session.getInstance(buildProperties(), new Authenticator() {
                @Override
                protected PasswordAuthentication getPasswordAuthentication() {
                    return new PasswordAuthentication(username, password);
                }
            });

            Transport transport = session.getTransport("smtp");
            transport.connect(host, Integer.parseInt(port), username, password);
            transport.close();
        } catch (Exception e) {
            throw new RuntimeException("Mail SMTP connection failed", e);
        }
    }
}