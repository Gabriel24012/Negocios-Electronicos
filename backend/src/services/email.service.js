const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

async function enviarAlertaStockBajo({
  to,
  proveedorNombre,
  productoNombre,
  stockActual,
  stockMinimo,
  faltan,
}) {
  if (!isValidEmail(to)) return { skipped: true, reason: "invalid_email" };

  const subject = `⚠️ Stock bajo: ${productoNombre}, se neceita reposición de unidades`;

  const html = `
    <div style="font-family: Arial, sans-serif">
      <h2>Alerta de Stock Bajo</h2>
      <p>Hola <b>${proveedorNombre || "Proveedor"}</b>,</p>
      <p>Se detectó que el siguiente producto está por debajo del stock mínimo:</p>
      <ul>
        <li><b>Producto:</b> ${productoNombre}</li>
        <li><b>Stock actual:</b> ${stockActual}</li>
        <li><b>Stock mínimo:</b> ${stockMinimo}</li>
      </ul>
      <p>Por favor confirmar disponibilidad y tiempo de entrega.</p>
      <hr />
      <small>Mensaje enviado automáticamente por el sistema SCM.</small>
    </div>
  `;

  await transporter.sendMail({
    from: `"Thrift Cálido" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });

  return { sent: true };
}

module.exports = { enviarAlertaStockBajo, isValidEmail };