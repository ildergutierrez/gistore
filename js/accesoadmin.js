document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.shiftKey && e.key === "E" || e.key === "e") {// Ctrl + Shift + E pero la letra E puede ser minuscula
    //si esta en la carperpeta raiz al oprimir la tecla se muestar la rura admin/index.html
    if (window.location.pathname === "/") {
      window.location.href = "/admin/index.html";
    }
    else {
      window.location.href = "../admin/index.html";
    }

  }
});