// Server-rendered Razorpay checkout page for mobile browsers. Pure
// template-string generation — a view concern, not business logic, so it
// stays out of the service layer per the migration plan. Moved verbatim
// from payment.routes.ts's inline `/checkout` handler.
export function renderPaymentCheckoutPage(params: {
  orderId: unknown;
  paymentId: unknown;
  amount: unknown;
  name: unknown;
  email: unknown;
  phone: unknown;
  redirectUrl: unknown;
  keyId: string;
}): string {
  const { orderId, paymentId, amount, name, email, phone, redirectUrl, keyId } = params;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Mahallu Payment Checkout</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            background-color: #FBF8F2;
            color: #0B4A42;
          }
          .loader {
            border: 4px solid #E2E8F0;
            border-top: 4px solid #C9972E;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin-bottom: 20px;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .title {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 10px;
          }
          .sub {
            font-size: 14px;
            color: #64748B;
            margin-bottom: 15px;
          }
          .button {
            display: inline-block;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 12px;
            font-weight: bold;
            font-size: 14px;
            margin-top: 15px;
            transition: opacity 0.2s;
          }
          .button:active {
            opacity: 0.8;
          }
        </style>
      </head>
      <body>
        <div id="loading" style="display: flex; flex-direction: column; align-items: center;">
          <div class="loader"></div>
          <div class="title">Initiating Secure Payment...</div>
          <div class="sub">Do not close this page or press back.</div>
        </div>

        <div id="success" style="display: none; flex-direction: column; align-items: center; text-align: center; padding: 20px;">
          <div style="font-size: 60px; color: #16A34A; margin-bottom: 15px;">✅</div>
          <div class="title" style="color: #16A34A; font-size: 22px;">Payment Successful!</div>
          <div class="sub" style="margin-bottom: 25px;">Your transaction has been verified successfully.</div>
          <a id="btn-success" href="#" class="button" style="background-color: #0B4A42;">Return to Mahallu App</a>
        </div>

        <div id="failure" style="display: none; flex-direction: column; align-items: center; text-align: center; padding: 20px;">
          <div style="font-size: 60px; color: #DC2626; margin-bottom: 15px;">❌</div>
          <div class="title" style="color: #DC2626; font-size: 22px;">Payment Failed</div>
          <div id="error-message" class="sub" style="margin-bottom: 25px;">Verification failed.</div>
          <a id="btn-failure" href="#" class="button" style="background-color: #DC2626;">Return to Mahallu App</a>
        </div>

        <script>
          let retryCount = 0;
          const customRedirectUrl = "${redirectUrl || 'mahallu://payments'}";

          function startCheckout() {
            try {
              if (typeof Razorpay === 'undefined') {
                if (retryCount > 100) { // Timeout after 10 seconds of retries
                  alert('Razorpay SDK failed to load. Please check your internet connection or reload the page.');
                  window.location.href = customRedirectUrl + "?status=failure&error=SDK+failed+to+load";
                  return;
                }
                retryCount++;
                setTimeout(startCheckout, 100);
                return;
              }

              const options = {
                key: "${keyId}",
                amount: ${amount},
                currency: "INR",
                name: "Mahallu ERP",
                description: "Dues & Donations Payment",
                order_id: "${orderId}",
                handler: async function (response) {
                  document.getElementById('loading').style.display = 'none';
                  try {
                    // Verify the payment signature on the backend
                    const verifyRes = await fetch(window.location.origin + '/api/v1/payments/verify', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        razorpay_order_id: response.razorpay_order_id,
                        razorpay_payment_id: response.razorpay_payment_id,
                        razorpay_signature: response.razorpay_signature,
                        paymentId: "${paymentId}"
                      })
                    });
                    const verifyData = await verifyRes.json();
                    if (verifyData.success) {
                      const target = customRedirectUrl + "?status=success&paymentId=${paymentId}";
                      document.getElementById('btn-success').href = target;
                      document.getElementById('success').style.display = 'flex';
                      window.location.href = target;
                    } else {
                      const errMsg = verifyData.message || 'Verification failed';
                      const target = customRedirectUrl + "?status=failure&error=" + encodeURIComponent(errMsg);
                      document.getElementById('error-message').textContent = errMsg;
                      document.getElementById('btn-failure').href = target;
                      document.getElementById('failure').style.display = 'flex';
                      window.location.href = target;
                    }
                  } catch (e) {
                    const target = customRedirectUrl + "?status=failure&error=" + encodeURIComponent(e.message);
                    document.getElementById('error-message').textContent = e.message;
                    document.getElementById('btn-failure').href = target;
                    document.getElementById('failure').style.display = 'flex';
                    window.location.href = target;
                  }
                },
                prefill: {
                  name: "${name || ''}",
                  email: "${email || ''}",
                  contact: "${phone || ''}"
                },
                theme: {
                  color: "#0B4A42"
                },
                modal: {
                  ondismiss: function() {
                    window.location.href = customRedirectUrl + "?status=cancelled";
                  }
                }
              };
              const rzp = new Razorpay(options);
              rzp.open();
            } catch (err) {
              document.getElementById('loading').style.display = 'none';
              document.getElementById('error-message').textContent = err.message;
              document.getElementById('failure').style.display = 'flex';
              window.location.href = customRedirectUrl + "?status=failure&error=" + encodeURIComponent(err.message);
            }
          }
          startCheckout();
        </script>
      </body>
    </html>
  `;
}
