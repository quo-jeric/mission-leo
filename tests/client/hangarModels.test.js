import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Box3 } from '../../client/vendor/three/three.module.js';
import { createPartModel, createAssemblyModel, disposeModel } from '../../client/js/three/hangarModels.js';

const { components } = JSON.parse(readFileSync(new URL('../../server/data/components.json', import.meta.url), 'utf8'));

describe('procedural component previews', () => {
  it('assembles a balanced pair of deployed wings without changing catalog power or area', () => {
    const bus = components.find(part => part.id === 'bus_6u');
    const solar = components.find(part => part.id === 'eps_solar_si_deploy_20w');
    const original = JSON.stringify(solar);
    const root = createAssemblyModel([bus, solar]);
    try {
      const wings = root.children.filter(item => item.userData.wingSide);
      expect(wings).toHaveLength(2);
      expect(wings[0].position.x).toBeCloseTo(-wings[1].position.x);
      expect(wings.reduce((sum, wing) => sum + wing.scale.x, 0)).toBe(1);
      expect(JSON.stringify(solar)).toBe(original);
      expect(root.children.filter(item => item.userData.part?.category === 'bus')).toHaveLength(1);
    } finally { disposeModel(root); }
  });

  it('keeps avionics within the closed hull and separates them only in exploded view', () => {
    const bus = components.find(part => part.id === 'bus_6u');
    const battery = components.find(part => part.id === 'eps_battery_li_20wh');
    const closed = createAssemblyModel([bus, battery]);
    const exploded = createAssemblyModel([bus, battery], { exploded: true });
    try {
      const inside = new Box3().setFromObject(closed.children.find(item => item.userData.part?.id === battery.id));
      expect(inside.min.x).toBeGreaterThan(-.05);
      expect(inside.max.x).toBeLessThan(.05);
      expect(inside.min.y).toBeGreaterThan(-.15);
      expect(inside.max.y).toBeLessThan(.15);
      const outside = new Box3().setFromObject(exploded.children.find(item => item.userData.part?.id === battery.id));
      expect(outside.min.x).toBeGreaterThan(.05);
    } finally { disposeModel(closed); disposeModel(exploded); }
  });

  it('builds finite, nonempty, pickable 3D geometry for the entire catalog', () => {
    for (const part of components) {
      const root = createPartModel(part);
      try {
        const bounds = new Box3().setFromObject(root);
        expect(bounds.isEmpty(), part.id).toBe(false);
        expect([...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite), part.id).toBe(true);
        let count = 0;
        root.traverse(object => {
          if (!object.isMesh) return;
          count++;
          expect(object.userData.part.id, 'raycast selection must resolve the catalog part').toBe(part.id);
          expect(object.geometry.attributes.position.array.every(Number.isFinite), part.id).toBe(true);
        });
        expect(count, part.id).toBeGreaterThan(0);
      } finally { disposeModel(root); }
    }
  });

  it('disposes shared materials and geometry exactly once on preview replacement', () => {
    const root = createPartModel(components.find(part => part.category === 'bus'));
    const resources = new Set();
    root.traverse(object => {
      if (object.geometry) resources.add(object.geometry);
      if (object.material) resources.add(object.material);
    });
    const disposals = new Map();
    for (const resource of resources) resource.addEventListener('dispose', () => disposals.set(resource, (disposals.get(resource) || 0) + 1));
    disposeModel(root);
    expect(disposals.size).toBe(resources.size);
    expect([...disposals.values()].every(count => count === 1)).toBe(true);
  });
});

// Audit actual rendered bounds: a nominal slot position alone does not prove
// that the visible antenna/panel base touches its chassis.
describe('assembly attachment continuity', () => {
  it('bridges every compatible exterior component to its hull', () => {
    for (const bus of components.filter(part => part.category === 'bus')) {
      const chassis = bus.chassisCompatibility[0];
      const exterior = components.filter(part => part.chassisCompatibility?.includes(chassis) && (
        ['eps_solar', 'comms', 'tcs'].includes(part.category) ||
        (part.category === 'propulsion' && !part.id.startsWith('adcs_'))
      ));
      for (const part of exterior) {
        const root = createAssemblyModel([bus, part]);
        try {
          const hull = new Box3().setFromObject(root.children.find(item => item.userData.part?.id === bus.id));
          const mounts = root.children.filter(item => item.userData.mountFor === part.id);
          const targets = root.children.filter(item => item.isGroup && item.userData.part?.id === part.id);
          for (const target of targets) {
            const bounds = new Box3().setFromObject(target);
            expect(mounts.some(mount => {
              const support = new Box3().setFromObject(mount);
              return support.intersectsBox(hull) && support.intersectsBox(bounds);
            }), `${bus.id}: ${part.id} must have continuous support`).toBe(true);
          }
        } finally { disposeModel(root); }
      }
    }
  });
});
