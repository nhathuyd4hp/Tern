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

describe('OverviewSection', () => {
  it('does not show grouping, naming or auth placement details', () => {
    const { queryByText } = renderOverview({ groupBy: 'tags', requestNameSource: 'summary', authPlacement: 'request' });

    expect(queryByText('Collection Grouping')).not.toBeInTheDocument();
    expect(queryByText('Request Naming')).not.toBeInTheDocument();
    expect(queryByText('Auth Placement')).not.toBeInTheDocument();
  });

  it('shows the auto-check interval next to the last synced time', () => {
    const { getByText, queryByText } = renderOverview({ autoCheck: true, autoCheckInterval: 15 });

    expect(detailItem(getByText, 'Last Synced At')).toHaveTextContent('Auto-check every 15 min');
    expect(queryByText('Auto Check for Updates')).not.toBeInTheDocument();
  });

  it('explains the auto-check interval in a tooltip on the badge', () => {
    const { getByText } = renderOverview({ autoCheck: true, autoCheckInterval: 15 });

    fireEvent.mouseEnter(getByText('Auto-check every 15 min').querySelector('svg').parentElement);

    expect(getByText('Tern checks the spec for changes every 15 minutes.', { exact: false })).toBeInTheDocument();
  });

  it('shows that auto-check is off next to the last synced time', () => {
    const { getByText } = renderOverview({ autoCheck: false });

    expect(detailItem(getByText, 'Last Synced At')).toHaveTextContent('Auto-check off');
  });
});
