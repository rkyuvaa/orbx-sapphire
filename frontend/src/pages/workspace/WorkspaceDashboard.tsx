import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTenant } from '../../context/TenantContext';
import { apiRequest } from '../../lib/api';
import { IconPhone } from '../../components/ui/Icons';

interface UpcomingOrder {
  id: string;
  order_number: string;
  status: string;
  priority: 'high' | 'normal' | 'low';
  due_date: string;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  is_overdue: boolean;
  description?: string | null;
  garment_description?: string | null;
}

const ORDER_CARD_COLORS = [
  { background: '#BFE9D3', border: '#218653', text: '#173B29' },
  { background: '#C6E2FF', border: '#2872B7', text: '#163451' },
  { background: '#DED3FF', border: '#7050B5', text: '#342456' },
  { background: '#FFE0A8', border: '#B87512', text: '#53380F' },
  { background: '#FFC9D1', border: '#B64055', text: '#54212B' },
  { background: '#BDEBE8', border: '#21817B', text: '#17403E' },
  { background: '#FFD1B8', border: '#B55C2E', text: '#542D1B' },
  { background: '#E4EBAF', border: '#74852B', text: '#394315' },
] as const;

const orderStatusLabels: Record<string, string> = {
  material_marking: 'Material Marking',
  design_work: 'Design Work',
  cutting: 'Cutting',
  stitching: 'Stitching',
  finishing: 'Finishing',
  trial: 'Trial',
  ready_for_delivery: 'Ready for Delivery',
};

function resolveCompanyTimezone(configuredTimezone?: unknown): string {
  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  if (typeof configuredTimezone !== 'string' || !configuredTimezone) return browserTimezone;
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: configuredTimezone });
    return configuredTimezone;
  } catch {
    return browserTimezone;
  }
}

function dateKeyInTimezone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function dateKeyAfter(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days, 12)).toISOString().slice(0, 10);
}

function formatColumnDate(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function formatOrderCreatedDate(value: string, timeZone: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone,
  }).format(new Date(value));
}

export function WorkspaceDashboard() {
  const { activeCompany, activeCompanyId } = useTenant();
  const navigate = useNavigate();
  const timezone = resolveCompanyTimezone(activeCompany?.settings?.timezone);
  const {
    data: upcomingOrders = [],
    isLoading: isLoadingUpcomingOrders,
    isError: upcomingOrdersFailed,
    error: upcomingOrdersError,
  } = useQuery<UpcomingOrder[], Error>({
    queryKey: ['workspace-upcoming-orders', activeCompanyId, timezone],
    queryFn: () => apiRequest<UpcomingOrder[]>(
      `/orders/upcoming?timezone=${encodeURIComponent(timezone)}`,
    ),
    enabled: Boolean(activeCompanyId),
    refetchInterval: 30_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const dueBuckets = useMemo(() => {
    const todayKey = dateKeyInTimezone(new Date(), timezone);
    const buckets = [
      { title: 'Due Today', dateKey: todayKey },
      { title: 'Due Tomorrow', dateKey: dateKeyAfter(todayKey, 1) },
      { title: 'Due in 2 Days', dateKey: dateKeyAfter(todayKey, 2) },
      { title: 'Due in 3 Days', dateKey: dateKeyAfter(todayKey, 3) },
      { title: 'Due in 4 Days', dateKey: dateKeyAfter(todayKey, 4) },
    ];

    return buckets.map((bucket) => ({
      ...bucket,
      orders: upcomingOrders
        .filter((order) => dateKeyInTimezone(new Date(order.due_date), timezone) === bucket.dateKey)
        .sort((left, right) => {
          const urgency = (order: UpcomingOrder) =>
            (order.is_overdue ? 3 : 0)
            + (order.priority === 'high' ? 2 : order.priority === 'normal' ? 1 : 0)
            + (order.status === 'ready_for_delivery' ? 1 : 0);
          return urgency(right) - urgency(left) || Date.parse(left.due_date) - Date.parse(right.due_date);
        }),
    }));
  }, [upcomingOrders, timezone]);
  const orderCardColors = useMemo(
    () => new Map(upcomingOrders.map((order, index) => [
      order.id,
      ORDER_CARD_COLORS[index % ORDER_CARD_COLORS.length],
    ])),
    [upcomingOrders],
  );

  const openOrder = (orderId: string) => {
    navigate(`/workspace/orders?order_id=${encodeURIComponent(orderId)}`);
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)' }}>
          Workspace Overview
        </h1>
      </div>

      <section className="due-board-section" aria-labelledby="due-board-title">
        <div className="due-board-heading">
          <div>
            <h2 id="due-board-title">Upcoming deliveries</h2>
            <p>Orders due over the next five days</p>
          </div>
          <span className="due-board-timezone">{timezone}</span>
        </div>
        {upcomingOrdersFailed ? (
          <div className="due-board-message due-board-error">
            {upcomingOrdersError.message || 'Unable to load upcoming orders.'}
          </div>
        ) : (
          <div className="due-board-columns" aria-busy={isLoadingUpcomingOrders}>
            {dueBuckets.map((bucket) => (
              <section
                className="due-board-column"
                key={bucket.dateKey}
                aria-label={`${bucket.title}, ${bucket.orders.length} orders`}
              >
                <header className="due-board-column-header">
                  <div>
                    <h3>{bucket.title}</h3>
                    <time dateTime={bucket.dateKey}>{formatColumnDate(bucket.dateKey)}</time>
                  </div>
                  <span className="due-board-count">{bucket.orders.length}</span>
                </header>
                {isLoadingUpcomingOrders ? (
                  <p className="due-board-empty">Loading orders…</p>
                ) : bucket.orders.length === 0 ? (
                  <p className="due-board-empty">No orders due this day.</p>
                ) : (
                  <div className="due-board-order-list">
                    {bucket.orders.map((order) => {
                      const description = order.garment_description || order.description;
                      const cardColor = orderCardColors.get(order.id) || ORDER_CARD_COLORS[0];

                      return (
                        <button
                          type="button"
                          className="due-order-card"
                          key={order.id}
                          onClick={() => openOrder(order.id)}
                          aria-label={`Open order ${order.order_number} for ${order.customer_name}`}
                          style={{
                            background: cardColor.background,
                            borderColor: cardColor.border,
                            borderLeftColor: cardColor.border,
                            color: cardColor.text,
                          }}
                        >
                          <div className="due-order-card-topline">
                            <strong className="due-order-number-label">{order.order_number}</strong>
                          </div>
                          <span className="due-order-customer">{order.customer_name}</span>
                          <div className="due-order-contact-row">
                            <span className="due-order-phone">
                              <IconPhone size={14} />{order.customer_phone}
                            </span>
                            <time dateTime={order.created_at}>
                              {formatOrderCreatedDate(order.created_at, timezone)}
                            </time>
                          </div>
                          {description && <span className="due-order-description">{description}</span>}
                          {order.status !== 'order_received' && (
                            <div className="due-order-card-footer">
                              <span className="due-order-status">
                                {orderStatusLabels[order.status] || order.status}
                              </span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}
