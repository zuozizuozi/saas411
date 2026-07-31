import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface EmailOtpEmailProps {
  otp: string;
  purpose: "sign-in" | "email-verification" | "forget-password";
  siteName: string;
}

const purposeCopy = {
  "sign-in": "sign in to",
  "email-verification": "verify your email for",
  "forget-password": "reset your password for",
} as const;

export const EmailOtpEmail = ({
  otp,
  purpose,
  siteName,
}: EmailOtpEmailProps) => (
  <Html>
    <Head />
    <Preview>{otp} is your {siteName} verification code</Preview>
    <Body style={styles.body}>
      <Container style={styles.container}>
        <Text style={styles.title}>{siteName}</Text>
        <Text style={styles.text}>
          Enter this code to {purposeCopy[purpose]} your account:
        </Text>
        <Section style={styles.codeSection}>
          <Text style={styles.code}>{otp}</Text>
        </Section>
        <Text style={styles.text}>
          This code expires in 5 minutes and can only be used once.
        </Text>
        <Text style={styles.text}>
          If you did not request this code, you can safely ignore this email.
        </Text>
        <Hr style={styles.hr} />
        <Text style={styles.footer}>{siteName}</Text>
      </Container>
    </Body>
  </Html>
);

const styles = {
  body: {
    backgroundColor: "#ffffff",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif',
  },
  container: {
    margin: "0 auto",
    padding: "20px 0 48px",
    maxWidth: "560px",
  },
  title: {
    fontSize: "24px",
    fontWeight: "bold" as const,
    textAlign: "center" as const,
    margin: "0 0 20px",
  },
  text: {
    fontSize: "16px",
    lineHeight: "26px",
    color: "#333333",
  },
  codeSection: {
    textAlign: "center" as const,
    margin: "32px 0",
  },
  code: {
    display: "inline-block",
    borderRadius: "8px",
    backgroundColor: "#f4f4f5",
    color: "#18181b",
    fontSize: "36px",
    fontWeight: "bold" as const,
    letterSpacing: "10px",
    margin: "0",
    padding: "16px 20px 16px 30px",
  },
  hr: {
    borderColor: "#e5e5e5",
    margin: "20px 0",
  },
  footer: {
    fontSize: "12px",
    color: "#666666",
    textAlign: "center" as const,
  },
};

export default EmailOtpEmail;
