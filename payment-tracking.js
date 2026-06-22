(function() {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref');
  if (ref) {
    localStorage.setItem('ultrah2_ref', ref);
    localStorage.setItem('ultrah2_ref_time', Date.now().toString());
    fetch('/api/affiliate/click', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ code: ref, page: window.location.pathname })
    }).catch(() => {});
  }

  function getRef() {
    const ref = localStorage.getItem('ultrah2_ref');
    const time = parseInt(localStorage.getItem('ultrah2_ref_time') || '0');
    if (ref && (Date.now() - time) < 30*24*60*60*1000) return ref;
    return null;
  }

  window.getCheckoutURL = function() {
    const base = '/checkout';
    const ref = getRef();
    return ref ? base + '?ref=' + ref : base;
  };

  document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.buy-now-btn, [data-buy]').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        window.location.href = getCheckoutURL();
      });
    });
  });
})();
