import '@testing-library/jest-dom';
import React from 'react';
import { fireEvent } from '@testing-library/react';
import { renderWithTheme } from 'components/OpenAPISyncTab/testUtils';
import OverviewSection from './index';

const renderOverview = (syncConfig) => renderWithTheme(
  <OverviewSection
    collection={{
      uid: 'pets-api',
      items: [],
      brunoConfig: { openapi: [{ sourceUrl: 'https://example.com/openapi.yaml', ...syncConfig }] }
    }}
    onTabSelect={jest.fn()}
    onOpenSettings={jest.fn()}
  />
);

const detailItem = (getByText, label) => getByText(label).closest('.spec-detail-item');

const hoverAutoCheckIcon = (getByText) => {
  fireEvent.mouseEnter(detailItem(getByText, 'Last Synced At').querySelector('.spec-detail-header svg').parentElement);
};

describe('OverviewSection', () => {
  it('does not show grouping, naming or auth placement details', () => {
    const { queryByText } = renderOverview({ groupBy: 'tags', requestNameSource: 'summary', authPlacement: 'request' });

    expect(queryByText('Collection Grouping')).not.toBeInTheDocument();
    expect(queryByText('Request Naming')).not.toBeInTheDocument();
    expect(queryByText('Auth Placement')).not.toBeInTheDocument();
  });

  it('shows the auto-check state as an icon that explains it on hover', () => {
    const { getByText, queryByText } = renderOverview({ autoCheck: true, autoCheckInterval: 15 });

    hoverAutoCheckIcon(getByText);

    expect(getByText('Auto-check every 15 min')).toBeInTheDocument();
    expect(getByText('Tern checks the spec for changes every 15 minutes.', { exact: false })).toBeInTheDocument();
    expect(queryByText('Auto Check for Updates')).not.toBeInTheDocument();
  });

  it('adds auto reload to the auto-check tooltip when it is on', () => {
    const { getByText } = renderOverview({ autoCheck: true, autoCheckInterval: 15, autoApply: true });

    hoverAutoCheckIcon(getByText);

    expect(getByText('Auto-check every 15 min · Auto reload')).toBeInTheDocument();
  });

  it('shows that auto-check is off in the tooltip', () => {
    const { getByText } = renderOverview({ autoCheck: false });

    hoverAutoCheckIcon(getByText);

    expect(getByText('Auto-check off')).toBeInTheDocument();
  });
});
