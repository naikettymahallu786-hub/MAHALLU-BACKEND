export function renderCashfreeCheckoutPage(params: {
  paymentSessionId: string;
  orderId: string;
  paymentId: string;
  amount: number | string;
  name: string;
  email: string;
  phone: string;
  redirectUrl: string;
  environment: 'sandbox' | 'production';
}): string {
  const { paymentSessionId, orderId, paymentId, amount, name, redirectUrl, environment } = params;

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <title>Mahallu Secure Payment - Cashfree</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <meta charset="utf-8">
        <script src="https://sdk.cashfree.com/js/v3/cashfree.js"></script>
        <style>
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #0B4A42 0%, #064E3B 100%);
            color: #FFFFFF;
            padding: 24px;
            text-align: center;
          }
          .card {
            background: #FFFFFF;
            color: #0F172A;
            border-radius: 28px;
            padding: 32px 24px;
            width: 100%;
            max-width: 420px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.25);
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .icon-wrap {
            width: 68px;
            height: 68px;
            border-radius: 34px;
            background: #ECFDF5;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 32px;
            margin-bottom: 18px;
            border: 2px solid #A7F3D0;
          }
          .title {
            font-size: 20px;
            font-weight: 900;
            color: #064E3B;
            margin-bottom: 6px;
          }
          .amount-tag {
            font-size: 28px;
            font-weight: 900;
            color: #0F172A;
            margin: 12px 0 6px 0;
          }
          .sub {
            font-size: 13px;
            color: #64748B;
            line-height: 1.5;
            margin-bottom: 24px;
          }
          .loader {
            border: 3.5px solid #E2E8F0;
            border-top: 3.5px solid #059669;
            border-radius: 50%;
            width: 36px;
            height: 36px;
            animation: spin 0.9s linear infinite;
            margin-bottom: 16px;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            padding: 15px 20px;
            border-radius: 16px;
            font-weight: 800;
            font-size: 15px;
            text-decoration: none;
            cursor: pointer;
            border: none;
            transition: transform 0.15s, opacity 0.15s;
          }
          .btn-primary {
            background: #059669;
            color: #FFFFFF;
            margin-top: 10px;
          }
          .btn-secondary {
            background: #F1F5F9;
            color: #475569;
            margin-top: 10px;
          }
          .btn:active {
            transform: scale(0.98);
            opacity: 0.9;
          }
          .badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            background: #FEF3C7;
            color: #92400E;
            margin-bottom: 10px;
          }
          .footer-note {
            font-size: 11px;
            color: rgba(255, 255, 255, 0.7);
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon-wrap">🕌</div>
          <span class="badge">Cashfree Verified Gateway</span>
          <h1 class="title">Mahallu ERP Payment</h1>
          <div class="amount-tag">₹${amount}</div>
          <p class="sub">Paying as <strong>${name || 'Mahallu Member'}</strong>.<br>Opening UPI, Cards, Netbanking & Wallets...</p>

          <div id="loader-box" style="display: flex; flex-direction: column; align-items: center;">
            <div class="loader"></div>
            <p style="font-size: 12px; font-weight: 700; color: #059669;">Connecting to Cashfree...</p>
          </div>

          <button id="btn-pay-now" class="btn btn-primary" style="display: none;" onclick="triggerCashfree()">
            Open Payment Screen
          </button>

          <button id="btn-cancel" class="btn btn-secondary" onclick="cancelPayment()">
            Cancel & Return
          </button>
        </div>

        <p class="footer-note">🔒 256-Bit SSL Encrypted • Powered by Cashfree Payments</p>

        <script>
          const customRedirectUrl = "${redirectUrl || 'mahallu://payments'}";
          const paymentSessionId = "${paymentSessionId}";
          const orderId = "${orderId}";
          const paymentId = "${paymentId}";
          const mode = "${environment === 'production' ? 'production' : 'sandbox'}";

          let cashfree = null;
          let retryCount = 0;

          function initializeCashfree() {
            if (typeof Cashfree !== 'undefined') {
              cashfree = Cashfree({ mode: mode });
              triggerCashfree();
            } else {
              if (retryCount > 80) {
                document.getElementById('loader-box').style.display = 'none';
                document.getElementById('btn-pay-now').style.display = 'inline-flex';
                return;
              }
              retryCount++;
              setTimeout(initializeCashfree, 100);
            }
          }

          function triggerCashfree() {
            if (!cashfree) {
              if (typeof Cashfree !== 'undefined') {
                cashfree = Cashfree({ mode: mode });
              } else {
                alert('Cashfree SDK is loading. Please tap Open Payment Screen again.');
                return;
              }
            }

            try {
              document.getElementById('loader-box').style.display = 'none';
              document.getElementById('btn-pay-now').style.display = 'inline-flex';

              cashfree.checkout({
                paymentSessionId: paymentSessionId,
                redirectTarget: "_self"
              }).then((result) => {
                if (result.error) {
                  console.error("Cashfree Checkout Error:", result.error);
                }
              }).catch((err) => {
                console.error("Checkout Exception:", err);
              });
            } catch (err) {
              console.error("Failed to launch checkout:", err);
            }
          }

          function cancelPayment() {
            window.location.href = customRedirectUrl + "?status=cancelled";
          }

          // Auto-start on load
          window.addEventListener('load', initializeCashfree);
          setTimeout(initializeCashfree, 300);
        </script>
      </body>
    </html>
  `;
}
