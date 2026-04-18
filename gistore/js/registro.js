
document.getElementById('btn').addEventListener('click', function (e) {
  e.preventDefault();
  const seoTexto = document.getElementById('seo-texto');
  if (seoTexto.style.display === 'none') {
    seoTexto.style.display = 'block';
  } else {
    seoTexto.style.display = 'none';
  }
});

const respuesta = await fetch('../php/notificacion.php');
const datos = await respuesta.json();

