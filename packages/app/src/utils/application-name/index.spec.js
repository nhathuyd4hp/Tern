import { findApplicationByName, normalizeApplicationName, selectWorkspaceApplications } from './index';

const applications = [
  { uid: 'a', name: 'Orders' },
  { uid: 'b', name: 'Billing' }
];

describe('application names', () => {
  it('compares names without caring for case or spaces around them', () => {
    expect(normalizeApplicationName('  ORDERS ')).toBe('orders');
    expect(normalizeApplicationName(undefined)).toBe('');
  });

  it('finds the application that already has the name', () => {
    expect(findApplicationByName(applications, ' orders')).toBe(applications[0]);
    expect(findApplicationByName(applications, 'Shipping')).toBeUndefined();
  });

  it('does not count the application itself', () => {
    expect(findApplicationByName(applications, 'Orders', 'a')).toBeUndefined();
    expect(findApplicationByName(applications, 'Orders', 'b')).toBe(applications[0]);
  });

  it('lists only the applications of the active workspace, scratch ones left out', () => {
    const state = {
      workspaces: { workspaces: [{ uid: 'w1', collections: [{ path: '/apps/Orders' }] }], activeWorkspaceUid: 'w1' },
      collections: {
        collections: [
          { uid: 'a', name: 'Orders', pathname: '/apps/Orders' },
          { uid: 'x', name: 'Elsewhere', pathname: '/apps/Elsewhere' }
        ]
      }
    };

    expect(selectWorkspaceApplications(state).map((application) => application.uid)).toEqual(['a']);
  });
});
