const { test, expect } = require('@playwright/test');
const { clearAppStorage, gotoApp, openPlannerTab } = require('./helpers/app');

// Auto-route dependency tests.
//
// The planner test API (`window._plannerTestApi`) lets us seed groups
// with fully-pinned items so `autoRouteGroup` bypasses the async
// suggested-cluster fetch (see leaflet.planner.js line ~765). This
// gives deterministic, network-free coordinates for assertions.

const G = 'test-group';

// Build a group of virtual items pinned at specified coords. Virtual
// items don't need to exist in the task library, which keeps tests
// independent of external data.
function makeGroup(items) {
  return {
    id: G,
    name: 'Route',
    items: items.map((it) => ({
      id: it.id,
      virtual: true,
      customName: it.id,
      pinCoords: { lat: it.lat, lng: it.lng },
      comments: [],
      dependsOn: it.dependsOn || [],
    })),
  };
}

async function seedAndRoute(page, items) {
  await page.evaluate((groups) => window._plannerTestApi.setGroups(groups), [makeGroup(items)]);
  return page.evaluate(async (gid) => await window._plannerTestApi.autoRouteGroup(gid), G);
}

function indexOfId(routed, id) {
  return routed.findIndex((i) => i.id === id);
}

test.describe('Auto-route: task dependencies', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppStorage(page);
    await gotoApp(page);
    await openPlannerTab(page);
  });

  test('dependent is placed after its single prerequisite', async ({ page }) => {
    // Layout: A at (0,0) is the pinned seed. B (far, 0,100) depends on C
    // (nearer, 0,10). Without deps, pure NN order is A -> C -> B anyway,
    // so we flip it: make B closer than C and have B depend on C.
    //
    //   A(0,0)  seed
    //   B(0,5)  depends on C   ← pure NN would pick B first
    //   C(0,20) no deps
    //
    // Correct order must be A, C, B.
    const routed = await seedAndRoute(page, [
      { id: 'A', lat: 0, lng: 0 },
      { id: 'B', lat: 0, lng: 5, dependsOn: ['C'] },
      { id: 'C', lat: 0, lng: 20 },
    ]);

    expect(indexOfId(routed, 'A')).toBeLessThan(indexOfId(routed, 'C'));
    expect(indexOfId(routed, 'C')).toBeLessThan(indexOfId(routed, 'B'));
  });

  test('chained dependencies A -> B -> C are all ordered correctly', async ({ page }) => {
    // Pinned seed is S. C depends on B, B depends on A. Geometric nearest
    // order is S, C, B, A (each successively farther), so dep enforcement
    // must reverse it to A, B, C.
    const routed = await seedAndRoute(page, [
      { id: 'S', lat: 0, lng: 0 },
      { id: 'C', lat: 0, lng: 5,  dependsOn: ['B'] },
      { id: 'B', lat: 0, lng: 10, dependsOn: ['A'] },
      { id: 'A', lat: 0, lng: 20 },
    ]);

    const sIdx = indexOfId(routed, 'S');
    const aIdx = indexOfId(routed, 'A');
    const bIdx = indexOfId(routed, 'B');
    const cIdx = indexOfId(routed, 'C');
    expect(sIdx).toBe(0);
    expect(aIdx).toBeLessThan(bIdx);
    expect(bIdx).toBeLessThan(cIdx);
  });

  test('multiple prerequisites all precede the dependent', async ({ page }) => {
    // X depends on both P1 and P2. Neither has deps. X is geometrically
    // closest to the seed, but must come last.
    const routed = await seedAndRoute(page, [
      { id: 'S',  lat: 0, lng: 0 },
      { id: 'X',  lat: 0, lng: 2,  dependsOn: ['P1', 'P2'] },
      { id: 'P1', lat: 0, lng: 15 },
      { id: 'P2', lat: 0, lng: 30 },
    ]);

    const xIdx = indexOfId(routed, 'X');
    expect(indexOfId(routed, 'P1')).toBeLessThan(xIdx);
    expect(indexOfId(routed, 'P2')).toBeLessThan(xIdx);
  });

  test('seed item with in-group prereqs routes prereqs first', async ({ page }) => {
    // S is the only pinned-at-input item (the auto-router's start point)
    // but it depends on P. Since groups are logical phases and prereqs
    // must come before dependents, P must precede S in the output.
    const routed = await seedAndRoute(page, [
      { id: 'S', lat: 0, lng: 0, dependsOn: ['P'] },
      { id: 'P', lat: 0, lng: 50 },
      { id: 'Q', lat: 0, lng: 5 },
    ]);

    const sIdx = indexOfId(routed, 'S');
    const pIdx = indexOfId(routed, 'P');
    expect(pIdx).toBeLessThan(sIdx);
    // Q has no deps and isn't a prereq of S, so it can appear anywhere
    // after P's placement pass completes — just assert it was placed.
    expect(indexOfId(routed, 'Q')).toBeGreaterThanOrEqual(0);
  });

  test('among multiple eligible tasks, nearest wins', async ({ page }) => {
    // All three items (X, Y, Z) have no deps. After seed S at (0,0),
    // nearest-neighbour should select Y first (closest), then X, then Z.
    const routed = await seedAndRoute(page, [
      { id: 'S', lat: 0, lng: 0 },
      { id: 'X', lat: 0, lng: 10 },
      { id: 'Y', lat: 0, lng: 3 },
      { id: 'Z', lat: 0, lng: 25 },
    ]);

    const order = routed.map((i) => i.id);
    expect(order).toEqual(['S', 'Y', 'X', 'Z']);
  });

  test('deps referencing items outside the routable set are ignored', async ({ page }) => {
    // Deps to nonexistent ids should not block routing. If the router
    // treated them as unmet prereqs, it would stall into the fallback.
    const routed = await seedAndRoute(page, [
      { id: 'S', lat: 0, lng: 0 },
      { id: 'A', lat: 0, lng: 10, dependsOn: ['GHOST'] },
      { id: 'B', lat: 0, lng: 20 },
    ]);

    // All three items placed, pure NN order (S, A, B) preserved.
    expect(routed.map((i) => i.id)).toEqual(['S', 'A', 'B']);
  });

  test('wouldCreateCycle detects direct and transitive cycles', async ({ page }) => {
    await page.evaluate((groups) => window._plannerTestApi.setGroups(groups), [
      makeGroup([
        { id: 'A', lat: 0, lng: 0 },
        { id: 'B', lat: 0, lng: 10, dependsOn: ['A'] },
        { id: 'C', lat: 0, lng: 20, dependsOn: ['B'] },
      ]),
    ]);

    // Direct: making A depend on B would cycle (B already depends on A).
    const directCycle = await page.evaluate(() => window._plannerTestApi.wouldCreateCycle('A', 'B'));
    expect(directCycle).toBe(true);

    // Transitive: making A depend on C would cycle via C->B->A.
    const transitiveCycle = await page.evaluate(() => window._plannerTestApi.wouldCreateCycle('A', 'C'));
    expect(transitiveCycle).toBe(true);

    // Self-dep is also a cycle.
    const selfCycle = await page.evaluate(() => window._plannerTestApi.wouldCreateCycle('A', 'A'));
    expect(selfCycle).toBe(true);

    // Non-cycle: making C depend on something new wouldn't cycle.
    const okEdge = await page.evaluate(() => window._plannerTestApi.wouldCreateCycle('C', 'A'));
    // C already indirectly depends on A via B, so adding another edge
    // C->A is redundant but not a cycle.
    expect(okEdge).toBe(false);
  });

  test('getDependents returns items that reference the given id', async ({ page }) => {
    await page.evaluate((groups) => window._plannerTestApi.setGroups(groups), [
      makeGroup([
        { id: 'root', lat: 0, lng: 0 },
        { id: 'd1', lat: 0, lng: 10, dependsOn: ['root'] },
        { id: 'd2', lat: 0, lng: 20, dependsOn: ['root'] },
        { id: 'unrelated', lat: 0, lng: 30 },
      ]),
    ]);

    const deps = await page.evaluate(() => window._plannerTestApi.getDependents('root'));
    expect(deps.sort()).toEqual(['d1', 'd2']);

    const noneUnrelated = await page.evaluate(() => window._plannerTestApi.getDependents('unrelated'));
    expect(noneUnrelated).toEqual([]);
  });
});
