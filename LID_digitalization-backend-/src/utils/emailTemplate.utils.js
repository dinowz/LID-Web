/**
 * Centralized Email Template Generator for LIND Digitalization System Reminders
 */

const renderBadge = (label, type = 'info') => {
  const styles = {
    warning: 'background: #fef3c7; color: #d97706;',
    success: 'background: #dcfce7; color: #15803d;',
    info: 'background: #e0f2fe; color: #0284c7;',
    purple: 'background: #f5f3ff; color: #6d28d9;',
    indigo: 'background: #e0e7ff; color: #4338ca;',
    teal: 'background: #ccfbf1; color: #0f766e;',
    rose: 'background: #ffe4e6; color: #be123c;',
    danger: 'background: #fee2e2; color: #dc2626;',
  };

  const style = styles[type] || styles.info;
  return `<span style="padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; font-family: sans-serif; ${style}">${label}</span>`;
};

const renderStandardEmailLayout = ({
  headerTitle = 'System Reminder',
  headerColor = '#1e40af',
  headerSubtext = 'LIND Digitalization System',
  recipientName = 'Tim Terkait',
  introMessage = '',
  tableColumns = [],
  tableRows = [],
  actionButtonText = 'Buka LIND Digitalization System',
  actionButtonUrl = process.env.CORS_ORIGIN || 'http://localhost:5173',
}) => {
  const dateTodayStr = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const columnHeaders = tableColumns
    .map(
      (col) =>
        `<th style="padding: 10px 12px; text-align: ${col.align || 'left'}; border-bottom: 2px solid #e5e7eb; font-weight: 600; color: #4b5563;">${col.title}</th>`
    )
    .join('');

  const rowHtml = tableRows
    .map((row) => {
      const cells = tableColumns
        .map((col) => {
          const val = row[col.key] !== undefined ? row[col.key] : '-';
          const align = col.align ? `text-align: ${col.align};` : 'text-align: left;';
          const style = col.style || '';
          return `<td style="padding: 10px 12px; border-bottom: 1px solid #f3f4f6; ${align} ${style}">${val}</td>`;
        })
        .join('');

      return `<tr>${cells}</tr>`;
    })
    .join('');

  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${headerTitle}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: Arial, Helvetica, sans-serif; -webkit-font-smoothing: antialiased;">
      
      <!-- Outer Container -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8fafc; padding: 32px 16px;">
        <tr>
          <td align="center">
            
            <!-- Main Card Container (Max Width 950px) -->
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 950px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08); border: 1px solid #e2e8f0;">
              
              <!-- Brand Header -->
              <tr>
                <td style="background-color: ${headerColor}; padding: 28px 36px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                      <td>
                        <h2 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.3px;">
                          ${headerTitle}
                        </h2>
                        <p style="margin: 6px 0 0 0; color: rgba(255, 255, 255, 0.85); font-size: 13px;">
                          ${headerSubtext} — ${dateTodayStr}
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Email Body -->
              <tr>
                <td style="padding: 32px 36px;">
                  
                  <!-- Greeting & Message -->
                  <p style="margin: 0 0 16px 0; color: #1e293b; font-size: 15px; line-height: 1.6;">
                    Halo <strong>${recipientName}</strong>,
                  </p>
                  <p style="margin: 0 0 24px 0; color: #334155; font-size: 14px; line-height: 1.6;">
                    ${introMessage}
                  </p>

                  <!-- Main Data Table -->
                  <div style="overflow-x: auto; margin-bottom: 28px; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="font-size: 13px; color: #334155; border-collapse: collapse;">
                      <thead>
                        <tr style="background-color: #f8fafc;">
                          ${columnHeaders}
                        </tr>
                      </thead>
                      <tbody>
                        ${rowHtml}
                      </tbody>
                    </table>
                  </div>

                  <!-- Call to Action Button -->
                  ${
                    actionButtonText
                      ? `
                  <div style="text-align: center; margin: 32px 0 16px 0;">
                    <a href="${actionButtonUrl}" target="_blank" style="display: inline-block; background-color: ${headerColor}; color: #ffffff; font-weight: 600; font-size: 14px; padding: 12px 28px; text-decoration: none; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                      ${actionButtonText} →
                    </a>
                  </div>
                  `
                      : ''
                  }

                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f8fafc; padding: 20px 36px; border-top: 1px solid #e2e8f0; text-align: center;">
                  <p style="margin: 0 0 6px 0; color: #64748b; font-size: 12px;">
                    Email pengingat ini dikirim secara otomatis oleh <strong>LIND Digitalization System</strong>.
                  </p>
                  <p style="margin: 0; color: #94a3b8; font-size: 11px;">
                    Silakan login ke portal sistem untuk memperbarui data terkait. Mohon untuk tidak membalas email ini.
                  </p>
                </td>
              </tr>

            </table>

          </td>
        </tr>
      </table>

    </body>
    </html>
  `;
};

module.exports = { renderStandardEmailLayout, renderBadge };
