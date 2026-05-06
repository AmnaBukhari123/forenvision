import smtplib
import os
from email.mime.text import MIMEText
from dotenv import load_dotenv

# Force load .env
load_dotenv()

EMAIL_ADDRESS = os.getenv("EMAIL_ADDRESS")
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD")

print("DEBUG EMAIL:", EMAIL_ADDRESS)
print("DEBUG PASS:", EMAIL_PASSWORD)

def send_email(to_email: str, subject: str, body: str):
    try:
        if not EMAIL_ADDRESS or not EMAIL_PASSWORD:
            raise ValueError("Missing email credentials from .env")

        msg = MIMEText(body)
        msg["Subject"] = subject
        msg["From"] = EMAIL_ADDRESS
        msg["To"] = to_email

        server = smtplib.SMTP("smtp.gmail.com", 587)
        server.starttls()
        server.login(EMAIL_ADDRESS, EMAIL_PASSWORD)
        server.sendmail(EMAIL_ADDRESS, to_email, msg.as_string())
        server.quit()

        print(f"Email sent to {to_email}")
        return True

    except Exception as e:
        print("Email error:", e)
        return False