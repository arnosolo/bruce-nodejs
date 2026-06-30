import { createTransport } from "nodemailer";

// ---------- 阿里云邮件推送 SMTP 配置 ----------
export const transporter = createTransport({
  host: 'smtpdm.aliyun.com', // 固定
  port: 465,                           // SSL
  secure: true,
  auth: {
    user: process.env.ALIYUN_DM_SMTP_USER, // 你刚创建的发信地址
    pass: process.env.ALIYUN_DM_SMTP_PASS                // 第4步设置的密码
  }
});

/**
 * 发送邮箱验证邮件 (验证码)
 * @param to 目标邮箱
 * @param code 6位验证码
 * @param expiryHours 有效期 (小时)
 */
export const sendVerificationEmail = async (to: string, code: string, expiryHours: number) => {
  const { ALIYUN_DM_SMTP_USER, ALIYUN_DM_SMTP_USER_NAME, APP_NAME } = process.env
  const mailOptions = {
    from: `"${ALIYUN_DM_SMTP_USER_NAME}" <${ALIYUN_DM_SMTP_USER}>`,
    to,
    subject: `【${APP_NAME}】账号安全验证通知`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #333;">感谢注册 ${APP_NAME}</h2>
        <p>您的邮箱验证码如下，请在 ${expiryHours} 小时内完成验证：</p>
        <div style="text-align: center; margin: 40px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 10px; color: #007bff; background: #f8f9fa; padding: 15px 30px; border-radius: 8px; border: 1px dashed #007bff;">
            ${code}
          </span>
        </div>
        <p style="color: #666; font-size: 14px;">如果您没有注册过该系统，请忽略此邮件。</p>
        <p style="color: #999; font-size: 12px; margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px;">
          此邮件由系统自动发送，请勿回复。
        </p>
      </div>
    `,
  };

  
  const info = await transporter.sendMail(mailOptions);

  // 打印阿里返回的投递ID、状态
  // console.log(mailOptions);
  // console.log('邮件发送回执:', info);
  // console.log('messageId:', info.messageId);

  return info
};

/**
 * 发送登录验证码邮件
 * @param to 目标邮箱
 * @param code 6位验证码
 * @param expiryMinutes 有效期 (分钟)
 */
export const sendLoginCodeEmail = async (to: string, code: string, expiryMinutes: number) => {
  const { ALIYUN_DM_SMTP_USER, ALIYUN_DM_SMTP_USER_NAME, APP_NAME } = process.env
  const mailOptions = {
    from: `"${ALIYUN_DM_SMTP_USER_NAME}" <${ALIYUN_DM_SMTP_USER}>`,
    to,
    subject: `【${APP_NAME}】登录验证码`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #333;">${APP_NAME} 登录验证</h2>
        <p>您正在尝试登录，验证码如下，请在 ${expiryMinutes} 分钟内完成验证：</p>
        <div style="text-align: center; margin: 40px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 10px; color: #28a745; background: #f8f9fa; padding: 15px 30px; border-radius: 8px; border: 1px dashed #28a745;">
            ${code}
          </span>
        </div>
        <p style="color: #dc3545; font-size: 14px;"><strong>安全提示：</strong>请勿将此验证码泄露给任何人（包括客服）。</p>
        <p style="color: #999; font-size: 12px; margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px;">
          此邮件由系统自动发送，请勿回复。
        </p>
      </div>
    `,
  };

  const info = await transporter.sendMail(mailOptions);
  return info
};
