import smtplib
from email.message import EmailMessage
from app.config import settings

def send_email(to_email: str, subject: str, content: str):
    if not settings.smtp_host or not settings.smtp_user:
        print(f"Mocking email to {to_email}. Subject: {subject}")
        return
        
    msg = EmailMessage()
    msg.set_content(content)
    msg['Subject'] = subject
    msg['From'] = settings.smtp_user
    msg['To'] = to_email
     
    server = smtplib.SMTP(settings.smtp_host, settings.smtp_port)
    server.starttls()
    server.login(settings.smtp_user, settings.smtp_password)
    server.send_message(msg)
    server.quit()
