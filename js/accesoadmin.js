document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.shiftKey && e.key === "E") {
    //si esta en la carperpeta raiz al oprimir la tecla se muestar la rura admin/index.html
    if (window.location.pathname === "/") {
      window.location.href = "/admin/index.html";
    }
    else {
      window.location.href = "../admin/index.html";
    }

  }
});