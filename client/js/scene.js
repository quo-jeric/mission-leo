// Start graphics independently: an optional UI/audio failure must not hide 3D.
import('./three/menuScene.js')
  .then(({ createMenuScene }) => createMenuScene())
  .catch(error => {
    document.querySelector('.space')?.classList.remove('has-3d');
    console.warn('3D menu unavailable; using illustrated background.', error);
  })
  .finally(() => {
    document.documentElement.classList.remove('scene-loading');
    const status = document.querySelector('#scene-status');
    if (status) {
      const ready = document.querySelector('.space')?.classList.contains('has-3d');
      status.textContent = ready ? 'Orbital scene ready' : 'Illustrated mode · 3D unavailable';
      status.hidden = ready;
    }
  });
