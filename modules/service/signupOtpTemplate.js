const getSignupOtpTemplate = (otpCode) => `
  <div style="margin:0;padding:0;background:#f6f7fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:30px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #eceff4;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:24px 28px 8px;text-align:center;">
                <h2 style="margin:0;color:#f4c316;font-size:32px;line-height:40px;font-weight:700;">FOUR SCORE</h2>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 28px 28px;">
                <h3 style="margin:0 0 16px;color:#f4c316;font-size:28px;line-height:34px;font-weight:700;">
                  Verify your email
                </h3>
                <p style="margin:0 0 12px;font-size:16px;line-height:26px;">
                  Hi,
                </p>
                <p style="margin:0 0 16px;font-size:16px;line-height:26px;color:#374151;">
                  Welcome to Four Score. Use this one-time code to confirm your email and activate your account.
                </p>
                <p style="margin:0 0 18px;text-align:center;">
                  <span style="display:inline-block;background:#f6f7fb;color:#111827;font-weight:700;font-size:28px;line-height:40px;padding:14px 28px;border-radius:10px;letter-spacing:6px;font-family:'Courier New',monospace;">
                    ${otpCode}
                  </span>
                </p>
                <p style="margin:0 0 8px;font-size:14px;line-height:22px;color:#4b5563;">
                  This code is valid for <strong>15 minutes</strong>.
                </p>
                <p style="margin:0;font-size:14px;line-height:22px;color:#4b5563;">
                  If you did not create an account, you can safely ignore this email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
`;

module.exports = {
  getSignupOtpTemplate,
};
