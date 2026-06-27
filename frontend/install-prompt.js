let deferredPrompt = null

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferredPrompt = e

  const dismissed = localStorage.getItem('pwa-banner-dismissed')
  if (dismissed) return

  const banner = document.getElementById('install-banner')
  if (banner) banner.style.display = 'flex'
})

window.addEventListener('appinstalled', () => {
  const banner = document.getElementById('install-banner')
  if (banner) banner.style.display = 'none'
  deferredPrompt = null
})

function installApp() {
  if (!deferredPrompt) return
  deferredPrompt.prompt()
  deferredPrompt.userChoice.then(result => {
    if (result.outcome === 'accepted') {
      const banner = document.getElementById('install-banner')
      if (banner) banner.style.display = 'none'
    }
    deferredPrompt = null
  })
}

function dismissBanner() {
  const banner = document.getElementById('install-banner')
  if (banner) banner.style.display = 'none'
  localStorage.setItem('pwa-banner-dismissed', 'true')
}
