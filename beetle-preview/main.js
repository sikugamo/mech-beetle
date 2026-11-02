// Model preview without the console: ?config / window.__SIM_CONFIG {view:{az,el,d,ty,tx}, t, state overrides}.
import {runSim} from 'teardown-kit/runtime.js';
import {BODY, restFoot, solveLeg} from '../beetle/kin.js';
import {createBeetleStage} from '../beetle/stage.js';

const D2R = Math.PI / 180;
runSim({duration: 10, fps: 60, theme: 'light', hud: {enabled: false}, director: {enabled: false}}, async ({cfg, canvas, capture}) => {
  const st = createBeetleStage({canvas});
  const resize = () => st.resize(1600, 900, capture ? devicePixelRatio || 1 : 1);
  resize();
  window.ST = st;
  return {
    resize,
    render(t) {
      const v = {az: 32, el: 13, d: 2.0, tx: 0.02, ty: 0.13, ...(cfg.view || {})};
      const legs = [0, 1, 2, 3, 4, 5].map((i) => {
        const r = restFoot(i);
        return solveLeg(i, [r[0], -BODY.height, r[1]]);
      });
      const s = {x: 0, y: BODY.height, pitch: 0, roll: 0, legs, horn: 0, elytra: 0, unfold: 0, beat: 0, t, explode: 0, iso: 0, isoSys: 'leg', ...(cfg.state || {})};
      st.frame(s, {tx: v.tx, ty: v.ty, tz: 0, az: v.az * D2R, el: v.el * D2R, d: v.d, sx: 0, sy: 0});
      return {};
    },
  };
});
