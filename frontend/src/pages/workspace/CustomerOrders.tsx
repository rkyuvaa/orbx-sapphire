import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiRequest } from '../../lib/api';
import { useTenant } from '../../context/TenantContext';
import { useToast } from '../../context/ToastContext';
import { IconPlus, IconPhone, IconOrders } from '../../components/ui/Icons';
import { MoreVertical, Trash2, Eye } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { handleRecordRowClick, handleRecordRowKeyDown } from '../../utils/recordRow';

type Section = 'orders' | 'customers' | 'measurements';
type OrderStatus =
  | 'order_received'
  | 'material_marking'
  | 'design_work'
  | 'cutting'
  | 'stitching'
  | 'finishing'
  | 'trial'
  | 'ready_for_delivery'
  | 'delivered'
  | 'cancelled';
type OrderPriority = 'high' | 'normal' | 'low';

interface Customer {
  id: string;
  company_id: string;
  name: string;
  phone_number: string;
  address?: string | null;
  notes?: string | null;
}

interface OrderNumbering {
  prefix: string;
  next_number: number;
}

interface MeasurementField {
  id: string;
  tab_id: string;
  name: string;
  field_type: 'text' | 'number' | 'textarea';
  unit: 'mm' | 'cm' | 'in' | 'mtr';
  required: boolean;
  enabled: boolean;
  order: number;
}

interface MeasurementTab {
  id: string;
  company_id: string;
  name: string;
  enabled: boolean;
  order: number;
  fields: MeasurementField[];
}

interface OrderMeasurement {
  id: string;
  customer_id?: string;
  order_id?: string;
  tab_id: string | null;
  field_id: string | null;
  tab_name: string;
  field_name: string;
  field_type: string;
  unit: string;
  value: string | null;
}

interface OrderStatusHistory {
  id: string;
  old_status: string;
  new_status: string;
  reason?: string | null;
  changed_at: string;
  changed_by_name?: string | null;
}

interface OrderSummary {
  id: string;
  company_id: string;
  order_number: string;
  order_date: string;
  status: OrderStatus;
  priority: OrderPriority;
  due_date?: string | null;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  is_overdue: boolean;
}

interface OrderDetails extends OrderSummary {
  customer_id: string;
  customer: Customer;
  created_by_name?: string | null;
  status_history: OrderStatusHistory[];
  measurements: OrderMeasurement[];
}

interface OrderMeasurementInput {
  tab_id: string;
  field_id: string;
  value: string;
}

interface CustomerMeasurementInput {
  field_id: string;
  value: string;
}

const STATUSES: { value: OrderStatus; label: string }[] = [
  { value: 'order_received', label: 'Order Received' },
  { value: 'material_marking', label: 'Material Marking' },
  { value: 'design_work', label: 'Design Work' },
  { value: 'cutting', label: 'Cutting' },
  { value: 'stitching', label: 'Stitching' },
  { value: 'finishing', label: 'Finishing' },
  { value: 'trial', label: 'Trial' },
  { value: 'ready_for_delivery', label: 'Ready for Delivery' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

const labelForStatus = (status: string) =>
  STATUSES.find((item) => item.value === status)?.label || status;

const inputStyle: React.CSSProperties = { width: '100%' };
const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))',
  gap: '12px',
};

function dateInputValue(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function todayInputValue() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function measurementMap(measurements: OrderMeasurement[]) {
  return measurements.reduce<Record<string, string>>((values, measurement) => {
    if (measurement.field_id) values[measurement.field_id] = measurement.value || '';
    return values;
  }, {});
}

function MeasurementEditor({
  tabs,
  activeTabId,
  onTabChange,
  values,
  onChange,
  idPrefix,
}: {
  tabs: MeasurementTab[];
  activeTabId: string;
  onTabChange: (tabId: string) => void;
  values: Record<string, string>;
  onChange: (fieldId: string, value: string) => void;
  idPrefix: string;
}) {
  const activeTab = tabs.find((tab) => tab.id === activeTabId) || tabs[0];
  if (!activeTab) return <p style={{ color: 'var(--t2)' }}>No measurement fields are configured.</p>;

  return (
    <div>
      <div role="tablist" aria-label="Customer measurement tabs" style={{ display: 'flex', flexWrap: 'wrap', gap: 4, borderBottom: '1px solid var(--bd)', marginBottom: 14 }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab.id === tab.id}
            aria-controls={`${idPrefix}-panel`}
            onClick={() => onTabChange(tab.id)}
            style={{
              padding: '9px 12px',
              color: activeTab.id === tab.id ? 'var(--pri)' : 'var(--t2)',
              borderBottom: activeTab.id === tab.id ? '2px solid var(--pri)' : '2px solid transparent',
              fontWeight: activeTab.id === tab.id ? 700 : 550,
              whiteSpace: 'nowrap',
            }}
          >
            {tab.name}
          </button>
        ))}
      </div>
      <div id={`${idPrefix}-panel`} role="tabpanel" style={gridStyle}>
        {activeTab.fields.map((field) => (
          <div className="fld" key={field.id} style={{ margin: 0 }}>
            <label htmlFor={`${idPrefix}-${field.id}`}>{field.name} ({field.unit}){field.required ? ' *' : ''}</label>
            {field.field_type === 'textarea' ? (
              <textarea
                id={`${idPrefix}-${field.id}`}
                required={field.required}
                rows={2}
                value={values[field.id] || ''}
                onChange={(event) => onChange(field.id, event.target.value)}
              />
            ) : (
              <input
                id={`${idPrefix}-${field.id}`}
                type="text"
                inputMode={field.field_type === 'number' ? 'decimal' : 'text'}
                required={field.required}
                value={values[field.id] || ''}
                onChange={(event) => onChange(field.id, event.target.value)}
              />
            )}
          </div>
        ))}
        {activeTab.fields.length === 0 && <p style={{ color: 'var(--t2)' }}>No fields in this tab.</p>}
      </div>
    </div>
  );
}

function dateLabel(value?: string | null) {
  return value ? new Date(value).toLocaleDateString() : 'Not set';
}

export function CustomerOrdersPage() {
  const { activeCompanyId, currentMembership } = useTenant();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const getSectionFromSearch = (): Section => {
    const value = searchParams.get('section');
    return value === 'customers' || value === 'measurements' ? value : 'orders';
  };
  const [section, setSection] = useState<Section>(getSectionFromSearch);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orderCustomerResults, setOrderCustomerResults] = useState<Customer[]>([]);
  const [tabs, setTabs] = useState<MeasurementTab[]>([]);
  const [configCompanyId, setConfigCompanyId] = useState<string | null>(null);
  const [selectedTabId, setSelectedTabId] = useState<string | null>(null);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [hasLoadedOrders, setHasLoadedOrders] = useState(false);
  const [hasLoadedCustomers, setHasLoadedCustomers] = useState(false);
  const [search, setSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [dueFrom, setDueFrom] = useState('');
  const [dueTo, setDueTo] = useState('');
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderDetails | null>(null);
  const [orderNumber, setOrderNumber] = useState('');
  const [defaultOrderNumber, setDefaultOrderNumber] = useState('');
  const [orderDate, setOrderDate] = useState(todayInputValue);
  const [customerId, setCustomerId] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [orderCustomerSearch, setOrderCustomerSearch] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<OrderPriority>('normal');
  const [newCustomer, setNewCustomer] = useState({ name: '', phone_number: '', address: '' });
  const [measurementValues, setMeasurementValues] = useState<Record<string, string>>({});
  const [orderMeasurementTabId, setOrderMeasurementTabId] = useState('');
  const [customerMeasurementCustomer, setCustomerMeasurementCustomer] = useState<Customer | null>(null);
  const [customerMeasurementValues, setCustomerMeasurementValues] = useState<Record<string, string>>({});
  const [customerMeasurementTabId, setCustomerMeasurementTabId] = useState('');
  const [detailMeasurementValues, setDetailMeasurementValues] = useState<Record<string, string>>({});
  const [detailMeasurementTabId, setDetailMeasurementTabId] = useState('');
  const openedOrderQueryId = useRef<string | null>(null);
  const [loadingCustomerMeasurements, setLoadingCustomerMeasurements] = useState(false);
  const [savingCustomerMeasurements, setSavingCustomerMeasurements] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customerForm, setCustomerForm] = useState({ name: '', phone_number: '', address: '' });
  const [customerEdit, setCustomerEdit] = useState<Customer | null>(null);
  const [customerFormSaving, setCustomerFormSaving] = useState(false);
  const [deletingCustomerId, setDeletingCustomerId] = useState<string | null>(null);
  const [activeOrderMenuId, setActiveOrderMenuId] = useState<string | null>(null);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [detailMenuOpen, setDetailMenuOpen] = useState(false);
  const [tabName, setTabName] = useState('');
  const [showTabForm, setShowTabForm] = useState(false);
  const [showFieldForm, setShowFieldForm] = useState(false);
  const [fieldDrafts, setFieldDrafts] = useState<Record<string, { name: string; field_type: string; unit: string; required: boolean }>>({});
  const configRequestId = useRef(0);
  const customerLookupRequestId = useRef(0);
  const ordersRequestId = useRef(0);
  const customerListRequestId = useRef(0);
  const ordersCompanyId = useRef(activeCompanyId);

  const canConfigure = currentMembership?.role === 'owner' || currentMembership?.role === 'admin';
  useEffect(() => {
    setSection(getSectionFromSearch());
  }, [searchParams]);

  useEffect(() => {
    if (ordersCompanyId.current === activeCompanyId) return;
    ordersCompanyId.current = activeCompanyId;
    ordersRequestId.current += 1;
    customerListRequestId.current += 1;
    setOrders([]);
    setCustomers([]);
    setTabs([]);
    setConfigCompanyId(null);
    setHasLoadedOrders(false);
    setHasLoadedCustomers(false);
    setLoadingOrders(true);
    setLoadingCustomers(true);
    setLoadingConfig(true);
  }, [activeCompanyId]);

  const loadOrders = useCallback(async () => {
    const requestId = ++ordersRequestId.current;
    if (!activeCompanyId) {
      setOrders([]);
      setLoadingOrders(false);
      setHasLoadedOrders(true);
      return;
    }
    setLoadingOrders(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter) params.set('status', statusFilter);
      if (overdueOnly) params.set('overdue', 'true');
      if (dueFrom) params.set('due_date_from', new Date(`${dueFrom}T00:00:00`).toISOString());
      if (dueTo) params.set('due_date_to', new Date(`${dueTo}T23:59:59`).toISOString());
      const results = await apiRequest<OrderSummary[]>(`/orders?${params.toString()}`);
      if (requestId === ordersRequestId.current) setOrders(results);
    } catch (error) {
      if (requestId === ordersRequestId.current) {
        toast(error instanceof Error ? error.message : 'Failed to load orders', 'error');
      }
    } finally {
      if (requestId === ordersRequestId.current) {
        setLoadingOrders(false);
        setHasLoadedOrders(true);
      }
    }
  }, [activeCompanyId, dueFrom, dueTo, overdueOnly, search, statusFilter, toast]);

  const [customerSearchTimeout, setCustomerSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  const loadCustomers = useCallback(async (query = '') => {
    const requestId = ++customerListRequestId.current;
    if (customerSearchTimeout) {
      clearTimeout(customerSearchTimeout);
    }
    setCustomerSearchTimeout(setTimeout(async () => {
      if (!activeCompanyId) {
        setCustomers([]);
        setLoadingCustomers(false);
        setHasLoadedCustomers(true);
        return;
      }
      setLoadingCustomers(true);
      try {
        const params = new URLSearchParams();
        if (query.trim().length >= 3) params.set('search', query.trim());
        const results = await apiRequest<Customer[]>(`/orders/customers${params.size ? `?${params}` : ''}`);
        if (requestId === customerListRequestId.current) setCustomers(results);
      } catch (error) {
        if (requestId === customerListRequestId.current) {
          toast(error instanceof Error ? error.message : 'Failed to load customers', 'error');
        }
      } finally {
        if (requestId === customerListRequestId.current) {
          setLoadingCustomers(false);
          setHasLoadedCustomers(true);
        }
      }
    }, 300));
  }, [activeCompanyId, toast]);

  const searchOrderCustomers = useCallback(async (query: string) => {
    const requestId = ++customerLookupRequestId.current;
    const normalizedQuery = query.trim();
    if (!activeCompanyId || normalizedQuery.length < 3) {
      setOrderCustomerResults([]);
      return;
    }
    try {
      const params = new URLSearchParams({ search: normalizedQuery, limit: '8' });
      const results = await apiRequest<Customer[]>(`/orders/customers?${params.toString()}`);
      if (requestId === customerLookupRequestId.current) setOrderCustomerResults(results);
    } catch (error) {
      if (requestId === customerLookupRequestId.current) {
        toast(error instanceof Error ? error.message : 'Failed to search customers', 'error');
      }
    }
  }, [activeCompanyId, toast]);

  const loadConfig = useCallback(async () => {
    const requestId = ++configRequestId.current;
    if (!activeCompanyId) {
      setTabs([]);
      setConfigCompanyId(null);
      setSelectedTabId(null);
      setLoadingConfig(false);
      return;
    }
    setLoadingConfig(true);
    try {
      const config = await apiRequest<MeasurementTab[]>('/orders/measurement-config');
      if (requestId === configRequestId.current && localStorage.getItem('orbx_active_company_id') === activeCompanyId) {
        setTabs(config);
        setConfigCompanyId(activeCompanyId);
      }
    } catch (error) {
      if (requestId === configRequestId.current) {
        toast(error instanceof Error ? error.message : 'Failed to load measurement setup', 'error');
      }
    } finally {
      if (requestId === configRequestId.current) setLoadingConfig(false);
    }
  }, [activeCompanyId, toast]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (section === 'orders') void loadCustomers();
    if (section === 'customers') void loadCustomers(customerSearch);
  }, [customerSearch, loadCustomers, section]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    if (!orderDialogOpen) {
      customerLookupRequestId.current += 1;
      return;
    }
    void searchOrderCustomers(orderCustomerSearch);
    return () => { customerLookupRequestId.current += 1; };
  }, [orderCustomerSearch, orderDialogOpen, searchOrderCustomers]);

  const companyTabs = configCompanyId === activeCompanyId ? tabs : [];
  const enabledTabs = useMemo(
    () => companyTabs.filter((tab) => tab.enabled).map((tab) => ({
      ...tab,
      fields: tab.fields.filter((field) => field.enabled),
    })),
    [companyTabs],
  );
  const orderMeasurementTab = enabledTabs.find((tab) => tab.id === orderMeasurementTabId) || enabledTabs[0] || null;
  const customerMeasurementTab = enabledTabs.find((tab) => tab.id === customerMeasurementTabId) || enabledTabs[0] || null;
  const detailMeasurementTab = enabledTabs.find((tab) => tab.id === detailMeasurementTabId) || enabledTabs[0] || null;
  const selectedTab = companyTabs.find((tab) => tab.id === selectedTabId) || companyTabs[0] || null;

  const openOrder = useCallback(async (orderId: string) => {
    try {
      const order = await apiRequest<OrderDetails>(`/orders/${orderId}`);
      setDueDate(dateInputValue(order.due_date));
      setPriority(order.priority);
      setOrderNumber(order.order_number);
      setOrderDate(dateInputValue(order.order_date));
      setDetailMeasurementValues(measurementMap(order.measurements));
      setSelectedOrder(order);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to load order details', 'error');
    }
  }, [toast]);

  const orderQueryId = searchParams.get('order_id');
  useEffect(() => {
    if (!orderQueryId || openedOrderQueryId.current === orderQueryId) return;
    openedOrderQueryId.current = orderQueryId;
    setSection('orders');
    void openOrder(orderQueryId);
  }, [openOrder, orderQueryId]);

  const openCreateOrder = () => {
    void (async () => {
      try {
        const numbering = await apiRequest<OrderNumbering>('/companies/current/document-numbering');
        const nextOrderNumber = `${numbering.prefix}${String(numbering.next_number).padStart(6, '0')}`;
        setDefaultOrderNumber(nextOrderNumber);
        setOrderNumber(nextOrderNumber);
        setOrderDate(todayInputValue());
        setCustomerId('');
        setSelectedCustomer(null);
        setOrderCustomerSearch('');
        setOrderCustomerResults([]);
        setDueDate('');
        setPriority('normal');
        setNewCustomer({ name: '', phone_number: '', address: '' });
        setMeasurementValues({});
        setOrderMeasurementTabId('');
        setOrderDialogOpen(true);
      } catch (error) {
        toast(error instanceof Error ? error.message : 'Failed to prepare the customer order', 'error');
      }
    })();
  };

  const loadCustomerMeasurementValues = async (customerIdToLoad: string) => {
    setLoadingCustomerMeasurements(true);
    try {
      const measurements = await apiRequest<OrderMeasurement[]>(`/orders/customers/${customerIdToLoad}/measurements`);
      return measurementMap(measurements);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to load customer measurements', 'error');
      throw error;
    } finally {
      setLoadingCustomerMeasurements(false);
    }
  };

  const openCustomerMeasurements = async (customer: Customer) => {
    setCustomerMeasurementCustomer(customer);
    setCustomerMeasurementTabId('');
    try {
      const values = await loadCustomerMeasurementValues(customer.id);
      setCustomerMeasurementValues(values);
    } catch {
      setCustomerMeasurementCustomer(null);
    }
  };

  const createOrder = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const measurements: OrderMeasurementInput[] = enabledTabs.flatMap((tab) =>
        tab.fields.map((field) => ({
          tab_id: tab.id,
          field_id: field.id,
          value: measurementValues[field.id] || '',
        })),
      );
      await apiRequest<OrderDetails>('/orders', {
        method: 'POST',
        body: JSON.stringify({
          order_number: orderNumber.trim() === defaultOrderNumber ? null : orderNumber.trim(),
          order_date: new Date(`${orderDate}T00:00:00`).toISOString(),
          ...(customerId ? { customer_id: customerId } : { customer: newCustomer }),
          due_date: dueDate ? new Date(`${dueDate}T23:59:59`).toISOString() : null,
          priority,
          measurements,
        }),
      });
      toast('Order created', 'success');
      setOrderDialogOpen(false);
      await Promise.all([loadOrders(), loadCustomers()]);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to create order', 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveCustomer = async (event: React.FormEvent) => {
    event.preventDefault();
    setCustomerFormSaving(true);
    try {
      if (customerEdit) {
        await apiRequest(`/orders/customers/${customerEdit.id}`, {
          method: 'PATCH',
          body: JSON.stringify(customerForm),
        });
        toast('Customer updated', 'success');
      } else {
        await apiRequest('/orders/customers', {
          method: 'POST',
          body: JSON.stringify(customerForm),
        });
        toast('Customer added to this company', 'success');
      }
      setCustomerDialogOpen(false);
      setCustomerEdit(null);
      setCustomerForm({ name: '', phone_number: '', address: '' });
      await loadCustomers(customerSearch);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to save customer', 'error');
    } finally {
      setCustomerFormSaving(false);
    }
  };

  const deleteCustomer = async (customer: Customer) => {
    if (!window.confirm(
      `Delete ${customer.name}? Customers with linked orders or saved measurements cannot be deleted.`
    )) {
      return;
    }

    setDeletingCustomerId(customer.id);
    try {
      await apiRequest(`/orders/customers/${customer.id}`, { method: 'DELETE' });
      setCustomers((current) => current.filter((item) => item.id !== customer.id));
      setOrderCustomerResults((current) => current.filter((item) => item.id !== customer.id));
      if (customerEdit?.id === customer.id) {
        setCustomerDialogOpen(false);
        setCustomerEdit(null);
      }
      if (customerMeasurementCustomer?.id === customer.id) {
        setCustomerMeasurementCustomer(null);
      }
      if (selectedOrder?.customer_id === customer.id) {
        setSelectedOrder(null);
      }
      toast('Customer deleted', 'success');
      await loadOrders();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to delete customer', 'error');
    } finally {
      setDeletingCustomerId(null);
    }
  };

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest('.order-action-menu-container')) {
        setActiveOrderMenuId(null);
        setDetailMenuOpen(false);
      }
    };
    if (activeOrderMenuId || detailMenuOpen) {
      document.addEventListener('click', handleOutsideClick);
      return () => document.removeEventListener('click', handleOutsideClick);
    }
  }, [activeOrderMenuId, detailMenuOpen]);

  const deleteOrder = async (order: OrderSummary | OrderDetails) => {
    if (!window.confirm(`Delete order ${order.order_number}? This cannot be undone.`)) {
      return;
    }
    setDeletingOrderId(order.id);
    try {
      await apiRequest(`/orders/${order.id}`, { method: 'DELETE' });
      setOrders((current) => current.filter((item) => item.id !== order.id));
      if (selectedOrder?.id === order.id) {
        setSelectedOrder(null);
      }
      toast(`Order ${order.order_number} deleted`, 'success');
      await loadOrders();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to delete order', 'error');
    } finally {
      setDeletingOrderId(null);
    }
  };

  const updateOrderDueDate = async () => {
    if (!selectedOrder) return;
    try {
      const updated = await apiRequest<OrderDetails>(`/orders/${selectedOrder.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          order_number: orderNumber.trim(),
          order_date: new Date(`${orderDate}T00:00:00`).toISOString(),
          due_date: dueDate ? new Date(`${dueDate}T23:59:59`).toISOString() : null,
          priority,
        }),
      });
      setSelectedOrder(updated);
      await loadOrders();
      toast('Order details saved', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to update order', 'error');
    }
  };

  const saveMeasurements = async () => {
    const isOrderContext = Boolean(selectedOrder && !customerMeasurementCustomer);
    const customer = customerMeasurementCustomer || selectedOrder?.customer || selectedCustomer;
    if (!customer && !isOrderContext) return;
    setSavingCustomerMeasurements(true);
    try {
      const payload: CustomerMeasurementInput[] = enabledTabs.flatMap((tab) =>
        tab.fields.map((field) => ({
          field_id: field.id,
          value: customerMeasurementCustomer
            ? customerMeasurementValues[field.id] || ''
            : detailMeasurementValues[field.id] || '',
        })),
      );
      if (isOrderContext && selectedOrder) {
        const saved = await apiRequest<OrderMeasurement[]>(
          `/orders/${selectedOrder.id}/measurements`,
          { method: 'PUT', body: JSON.stringify(payload) },
        );
        setSelectedOrder((prev) => (prev ? { ...prev, measurements: saved } : null));
        setDetailMeasurementValues(measurementMap(saved));
        toast('Order measurements saved', 'success');
      } else if (customer) {
        const saved = await apiRequest<OrderMeasurement[]>(
          `/orders/customers/${customer.id}/measurements`,
          { method: 'PUT', body: JSON.stringify(payload) },
        );
        setCustomerMeasurementValues(measurementMap(saved));
        await loadCustomers(customerSearch);
        toast('Customer default measurements saved', 'success');
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to save measurements', 'error');
    } finally {
      setSavingCustomerMeasurements(false);
    }
  };

  const changeStatus = async (nextStatus: OrderStatus) => {
    if (!selectedOrder) return;
    let reason: string | undefined;
    if (nextStatus === 'cancelled') {
      reason = window.prompt('Enter a reason for cancelling this order:')?.trim();
      if (!reason) return;
    }
    try {
      const updated = await apiRequest<OrderDetails>(`/orders/${selectedOrder.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus, reason }),
      });
      setSelectedOrder(updated);
      await loadOrders();
      toast(`Status changed to ${labelForStatus(nextStatus)}`, 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to update order status', 'error');
    }
  };

  const createTab = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const createdTab = await apiRequest<MeasurementTab>('/orders/measurement-config/tabs', {
        method: 'POST',
        body: JSON.stringify({ name: tabName.trim(), fields: [] }),
      });
      setTabName('');
      setSelectedTabId(createdTab.id);
      setShowTabForm(false);
      await loadConfig();
      toast('Measurement tab created', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to create tab', 'error');
    }
  };

  const saveTab = async (tab: MeasurementTab, updates: Partial<Pick<MeasurementTab, 'name' | 'enabled'>>) => {
    try {
      await apiRequest(`/orders/measurement-config/tabs/${tab.id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      await loadConfig();
      toast('Measurement tab updated', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to update tab', 'error');
    }
  };

  const deleteTab = async (tab: MeasurementTab) => {
    if (!window.confirm(`Delete the "${tab.name}" measurement tab and all its fields? This cannot be undone.`)) return;
    try {
      await apiRequest(`/orders/measurement-config/tabs/${tab.id}`, { method: 'DELETE' });
      const remainingTabs = companyTabs.filter((item) => item.id !== tab.id);
      setSelectedTabId(remainingTabs[0]?.id || null);
      setFieldDrafts((current) => {
        const next = { ...current };
        delete next[tab.id];
        return next;
      });
      await loadConfig();
      toast('Measurement tab deleted', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to delete measurement tab', 'error');
    }
  };

  const addField = async (tab: MeasurementTab) => {
    const draft = fieldDrafts[tab.id];
    if (!draft?.name.trim()) {
      toast('Enter a field name first', 'error');
      return;
    }
    try {
      await apiRequest(`/orders/measurement-config/tabs/${tab.id}/fields`, {
        method: 'POST',
        body: JSON.stringify({
          name: draft.name.trim(),
          field_type: draft.field_type,
          unit: draft.unit,
          required: draft.required,
        }),
      });
      setFieldDrafts((current) => ({ ...current, [tab.id]: { ...draft, name: '' } }));
      setShowFieldForm(false);
      await loadConfig();
      toast('Measurement field added', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to add field', 'error');
    }
  };

  const saveField = async (field: MeasurementField, updates: Partial<MeasurementField>) => {
    try {
      await apiRequest(`/orders/measurement-config/fields/${field.id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      await loadConfig();
      toast('Measurement field updated', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to update field', 'error');
    }
  };

  const moveTab = async (tab: MeasurementTab, direction: -1 | 1) => {
    const ordered = [...tabs].sort((a, b) => a.order - b.order);
    const index = ordered.findIndex((item) => item.id === tab.id);
    const target = index + direction;
    if (target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    try {
      await apiRequest('/orders/measurement-config/tabs/order', {
        method: 'PUT',
        body: JSON.stringify({ tab_ids: ordered.map((item) => item.id) }),
      });
      await loadConfig();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to reorder tabs', 'error');
    }
  };

  const moveField = async (tab: MeasurementTab, field: MeasurementField, direction: -1 | 1) => {
    const ordered = [...tab.fields].sort((a, b) => a.order - b.order);
    const index = ordered.findIndex((item) => item.id === field.id);
    const target = index + direction;
    if (target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    try {
      await apiRequest(`/orders/measurement-config/tabs/${tab.id}/fields/order`, {
        method: 'PUT',
        body: JSON.stringify({ field_ids: ordered.map((item) => item.id) }),
      });
      await loadConfig();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to reorder fields', 'error');
    }
  };

  const openCustomerEdit = (customer: Customer) => {
    setCustomerEdit(customer);
    setCustomerForm({
      name: customer.name,
      phone_number: customer.phone_number,
      address: customer.address || '',
    });
    setCustomerDialogOpen(true);
  };

  const currentStatusIndex = selectedOrder
    ? STATUSES.filter((item) => item.value !== 'cancelled').findIndex((item) => item.value === selectedOrder.status)
    : -1;
  const nextStatus = currentStatusIndex >= 0 && currentStatusIndex < STATUSES.length - 2
    ? STATUSES[currentStatusIndex + 1]
    : null;

  const renderHeader = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>Customer Orders</h1>
      {section === 'orders' && (
        <button type="button" className="btn pri" onClick={openCreateOrder}>
          <IconPlus size={16} /> New order
        </button>
      )}
      {section === 'customers' && (
        <button type="button" className="btn pri" onClick={() => {
          setCustomerEdit(null);
          setCustomerForm({ name: '', phone_number: '', address: '' });
          setCustomerDialogOpen(true);
        }}>
          <IconPlus size={16} /> Add customer
        </button>
      )}
    </div>
  );

  return (
    <div className="anim-rise">
      {renderHeader}
      <div style={{ display: 'flex', alignItems: 'flex-end', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
        {section === 'orders' && (
          <div style={{ display: 'flex', flex: '1 1 720px', alignItems: 'flex-end', flexWrap: 'wrap', gap: 8, minWidth: 0 }}>
            <div className="fld" style={{ flex: '1 1 160px', minWidth: 120, margin: 0, gap: 3 }}>
              <label htmlFor="order-search" style={{ fontSize: 11 }}>Search</label>
              <div style={{ position: 'relative' }}>
                <input id="order-search" style={{ ...inputStyle, height: 32 }} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Order, customer or phone" />
              </div>
            </div>
            <div className="fld" style={{ flex: '0.8 1 105px', minWidth: 95, margin: 0, gap: 3 }}>
              <label htmlFor="status-filter" style={{ fontSize: 11 }}>Status</label>
              <select id="status-filter" style={{ width: '100%', minWidth: 0, height: 32, padding: '0 8px' }} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="">All statuses</option>
                {STATUSES.map((statusItem) => <option key={statusItem.value} value={statusItem.value}>{statusItem.label}</option>)}
              </select>
            </div>
            <div className="fld" style={{ flex: '0.9 1 120px', minWidth: 110, margin: 0, gap: 3 }}>
              <label htmlFor="due-from" style={{ fontSize: 11 }}>Due from</label>
              <input id="due-from" type="date" style={{ width: '100%', minWidth: 0, height: 32, padding: '0 6px' }} value={dueFrom} onChange={(event) => setDueFrom(event.target.value)} />
            </div>
            <div className="fld" style={{ flex: '0.9 1 120px', minWidth: 110, margin: 0, gap: 3 }}>
              <label htmlFor="due-to" style={{ fontSize: 11 }}>Due to</label>
              <input id="due-to" type="date" style={{ width: '100%', minWidth: 0, height: 32, padding: '0 6px' }} value={dueTo} onChange={(event) => setDueTo(event.target.value)} />
            </div>
            <label style={{ display: 'inline-flex', flex: '0 1 125px', alignItems: 'center', gap: 6, color: 'var(--t2)', fontSize: 12, minHeight: 32 }}>
              <input type="checkbox" checked={overdueOnly} onChange={(event) => setOverdueOnly(event.target.checked)} />
              Overdue only
            </label>
          </div>
        )}
      </div>

      {section === 'orders' && (
        <>
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '15px 18px', borderBottom: '1px solid var(--bd)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{ fontSize: 15, fontWeight: 750 }}>Orders <span style={{ color: 'var(--t2)', fontWeight: 500 }}>({orders.length})</span></h2>
                {loadingOrders && hasLoadedOrders && <span className="data-refresh-indicator" role="status">Updating…</span>}
              </div>
              <button type="button" className="btn sm" onClick={() => void loadOrders()}>Refresh</button>
            </div>
            <div className="stable-table-container" style={{ overflowX: 'auto' }} aria-busy={loadingOrders}>
              <table className="stable-data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 700 }}>
                <thead>
                  <tr style={{ color: 'var(--t2)', fontSize: 11, textTransform: 'uppercase', borderBottom: '1px solid var(--bd)' }}>
                    {['Order', 'Customer', 'Status', 'Due date', 'Order date', ''].map((heading) => <th key={heading} style={{ padding: '12px 16px' }}>{heading}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {loadingOrders && !hasLoadedOrders ? (
                    <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--t2)' }}>Loading orders…</td></tr>
                  ) : orders.length === 0 ? (
                    <tr><td colSpan={6} style={{ padding: 36, textAlign: 'center', color: 'var(--t2)' }}>
                      <IconOrders size={24} /><p style={{ marginTop: 8 }}>No orders found for these filters.</p>
                    </td></tr>
                  ) : orders.map((order) => (
                    <tr
                      key={order.id}
                      className="record-row"
                      tabIndex={0}
                      aria-label={`Open order ${order.order_number}`}
                      onClick={(event) => handleRecordRowClick(event, () => { void openOrder(order.id); })}
                      onKeyDown={(event) => handleRecordRowKeyDown(event, () => { void openOrder(order.id); })}
                      style={{ borderBottom: '1px solid var(--bd)' }}
                    >
                      <td style={{ padding: '14px 16px', fontWeight: 750 }}>{order.order_number}</td>
                      <td style={{ padding: '14px 16px' }}>
                        <b>{order.customer_name}</b><small style={{ display: 'block', color: 'var(--t2)' }}>{order.customer_phone}</small>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span className={`badge ${order.status === 'cancelled' ? 'danger' : order.status === 'delivered' ? 'active' : 'pending'}`}>{labelForStatus(order.status)}</span>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        {dateLabel(order.due_date)} {order.is_overdue && <span className="badge overdue">Overdue</span>}
                      </td>
                      <td style={{ padding: '14px 16px', color: 'var(--t2)' }}>{dateLabel(order.order_date)}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <div className="order-action-menu-container" style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <button type="button" className="btn sm" onClick={() => void openOrder(order.id)}>View details</button>
                          <button
                            type="button"
                            className="btn sm"
                            aria-label={`Actions for order ${order.order_number}`}
                            title="More actions"
                            style={{ padding: '0 6px', height: 32, width: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            onClick={(event) => {
                              event.stopPropagation();
                              setActiveOrderMenuId((curr) => curr === order.id ? null : order.id);
                            }}
                          >
                            <MoreVertical size={16} />
                          </button>
                          {activeOrderMenuId === order.id && (
                            <div
                              className="dropdown-menu"
                              style={{
                                position: 'absolute',
                                right: 0,
                                top: '100%',
                                marginTop: 4,
                                background: 'var(--card)',
                                border: '1px solid var(--bd)',
                                borderRadius: 8,
                                boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                                zIndex: 60,
                                minWidth: 150,
                                padding: 4,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 2,
                                textAlign: 'left',
                              }}
                              onClick={(event) => event.stopPropagation()}
                            >
                              <button
                                type="button"
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  width: '100%',
                                  padding: '8px 12px',
                                  border: 'none',
                                  background: 'transparent',
                                  color: 'var(--text)',
                                  fontSize: 13,
                                  cursor: 'pointer',
                                  borderRadius: 6,
                                  textAlign: 'left',
                                }}
                                onClick={() => {
                                  setActiveOrderMenuId(null);
                                  void openOrder(order.id);
                                }}
                              >
                                <Eye size={14} /> View details
                              </button>
                              <button
                                type="button"
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  width: '100%',
                                  padding: '8px 12px',
                                  border: 'none',
                                  background: 'transparent',
                                  color: 'var(--danger, #ef4444)',
                                  fontSize: 13,
                                  cursor: 'pointer',
                                  borderRadius: 6,
                                  textAlign: 'left',
                                }}
                                disabled={deletingOrderId === order.id}
                                onClick={() => {
                                  setActiveOrderMenuId(null);
                                  void deleteOrder(order);
                                }}
                              >
                                <Trash2 size={14} /> {deletingOrderId === order.id ? 'Deleting…' : 'Delete order'}
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {section === 'customers' && (
        <>
          <div className="card" style={{ padding: 14, marginBottom: 14 }}>
            <div className="fld" style={{ margin: 0, maxWidth: 420 }}>
              <label htmlFor="customer-search">Find by customer name or phone number</label>
              <input
      id="customer-search"
      value={customerSearch}
      onChange={(event) => {
        const value = event.target.value;
        setCustomerSearch(value);
        if (value.length >= 3) {
          loadCustomers(value);
        } else if (value.length > 0) {
          setCustomers([]);
        }
      }}
      placeholder="Type at least 3 characters to search"
    />
            </div>
          </div>
          <div className="card" style={{ overflow: 'hidden' }} aria-busy={loadingCustomers}>
            <div style={{ padding: '15px 18px', borderBottom: '1px solid var(--bd)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{ fontSize: 15, fontWeight: 750 }}>Company customers ({customers.length})</h2>
                {loadingCustomers && hasLoadedCustomers && <span className="data-refresh-indicator" role="status">Updating…</span>}
              </div>
            </div>
            <div className="stable-list-container">
              {loadingCustomers && !hasLoadedCustomers ? <p className="stable-list-placeholder" style={{ padding: 24, color: 'var(--t2)' }}>Loading customers…</p> : customers.length === 0 ? (
                <p style={{ padding: 24, color: 'var(--t2)' }}>No customers found. Add a customer to start an order.</p>
              ) : customers.map((customer) => (
                <div
                  key={customer.id}
                  className="record-row"
                  role="group"
                  tabIndex={0}
                  aria-label={`Open customer ${customer.name}`}
                  onClick={(event) => handleRecordRowClick(event, () => openCustomerEdit(customer))}
                  onKeyDown={(event) => handleRecordRowKeyDown(event, () => openCustomerEdit(customer))}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--bd)' }}
                >
                  <div style={{ minWidth: 0 }}>
                    <b>{customer.name}</b>
                    <div style={{ color: 'var(--t2)', fontSize: 12.5, display: 'flex', gap: 7, alignItems: 'center', marginTop: 3 }}>
                      <IconPhone size={14} /> {customer.phone_number} {customer.address && <span>· {customer.address}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className="btn sm" onClick={() => void openCustomerMeasurements(customer)}>Measurements</button>
                    <button type="button" className="btn sm" onClick={() => openCustomerEdit(customer)}>Edit</button>
                    <button
                      type="button"
                      className="btn sm danger"
                      disabled={deletingCustomerId === customer.id}
                      onClick={() => void deleteCustomer(customer)}
                    >
                      {deletingCustomerId === customer.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {section === 'measurements' && (
        <div style={{ display: 'grid', gap: 12 }}>
          {!canConfigure && <div className="card" style={{ padding: 14, marginBottom: 14, color: 'var(--t2)' }}>Only company owners and administrators can change measurement settings.</div>}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--bd)' }}>
            <div role="tablist" aria-label="Measurement tabs" style={{ display: 'flex', flex: '1 1 auto', flexWrap: 'wrap', gap: 4 }}>
              {companyTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={selectedTab?.id === tab.id}
                  aria-controls="measurement-tab-panel"
                  style={{
                    minHeight: 40,
                    padding: '0 14px',
                    border: 0,
                    borderBottom: selectedTab?.id === tab.id ? '2px solid var(--color-accent)' : '2px solid transparent',
                    borderRadius: 0,
                    background: 'transparent',
                    color: selectedTab?.id === tab.id ? 'var(--color-accent)' : 'var(--t2)',
                    fontWeight: selectedTab?.id === tab.id ? 700 : 600,
                    whiteSpace: 'nowrap',
                  }}
                  onClick={() => setSelectedTabId(tab.id)}
                >
                  {tab.name}{!tab.enabled ? ' (Disabled)' : ''}
                </button>
              ))}
            </div>
            {canConfigure && !showTabForm && (
              <button type="button" className="btn sm" onClick={() => setShowTabForm(true)}>
                <IconPlus size={14} /> Tab
              </button>
            )}
          </div>
          {showTabForm && canConfigure && (
            <Modal title="Create measurement tab" onClose={() => { setShowTabForm(false); setTabName(''); }}>
              <form onSubmit={createTab}>
                <div className="fld">
                  <label htmlFor="new-measurement-tab-name">Tab name</label>
                  <input id="new-measurement-tab-name" className="measurement-config-field" autoFocus value={tabName} onChange={(event) => setTabName(event.target.value)} placeholder="e.g. Blouse" required minLength={2} />
                </div>
                <div className="app-modal-actions">
                  <button type="button" className="btn" onClick={() => { setShowTabForm(false); setTabName(''); }}>Cancel</button>
                  <button type="submit" className="btn pri"><IconPlus size={15} /> Add tab</button>
                </div>
              </form>
            </Modal>
          )}
          <div className="stable-config-container">
            {loadingConfig && companyTabs.length === 0 ? <p className="stable-config-placeholder" style={{ color: 'var(--t2)' }}>Loading measurement setup…</p> : companyTabs.length === 0 ? (
              <div className="card" style={{ padding: 20, color: 'var(--t2)' }}>No measurement tabs configured yet. Use “+ Tab” to create one.</div>
            ) : (
              selectedTab && (
                <section id="measurement-tab-panel" role="tabpanel" aria-label={`${selectedTab.name} measurement configuration`} className="card" style={{ overflow: 'hidden' }}>
                  <div style={{ padding: 16, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottom: '1px solid var(--bd)' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: '1 1 260px' }}>
                      <input key={selectedTab.id} className="measurement-config-field" aria-label={`${selectedTab.name} tab name`} defaultValue={selectedTab.name} disabled={!canConfigure} onBlur={(event) => {
                        const value = event.currentTarget.value.trim();
                        if (value && value !== selectedTab.name) void saveTab(selectedTab, { name: value });
                      }} style={{ ...inputStyle, maxWidth: 280, fontWeight: 700 }} />
                      <span className={`badge ${selectedTab.enabled ? 'active' : 'pending'}`}>{selectedTab.enabled ? 'Enabled' : 'Disabled'}</span>
                    </div>
                    {canConfigure && <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <button type="button" className="btn sm" aria-label="Move tab up" disabled={companyTabs.findIndex((item) => item.id === selectedTab.id) === 0} onClick={() => void moveTab(selectedTab, -1)}>↑</button>
                      <button type="button" className="btn sm" aria-label="Move tab down" disabled={companyTabs.findIndex((item) => item.id === selectedTab.id) === companyTabs.length - 1} onClick={() => void moveTab(selectedTab, 1)}>↓</button>
                      <button type="button" className="btn sm" onClick={() => void saveTab(selectedTab, { enabled: !selectedTab.enabled })}>{selectedTab.enabled ? 'Disable' : 'Enable'}</button>
                      <button type="button" className="btn sm" onClick={() => void deleteTab(selectedTab)} style={{ color: 'var(--color-error)' }}>Delete tab</button>
                    </div>}
                  </div>
                  <div style={{ padding: '4px 16px' }}>
                    {selectedTab.fields.map((field, fieldIndex) => (
                      <div key={field.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: '11px 0', borderBottom: '1px solid var(--bd)' }}>
                        <input
                          className="measurement-config-field"
                          aria-label={`${field.name} field name`}
                          defaultValue={field.name}
                          disabled={!canConfigure}
                          onBlur={(event) => {
                            const value = event.currentTarget.value.trim();
                            if (value && value !== field.name) void saveField(field, { name: value });
                          }}
                          style={{ flex: '1 1 130px', maxWidth: 220 }}
                        />
                        <select className="measurement-config-field" aria-label={`${field.name} input type`} value={field.field_type} disabled={!canConfigure} onChange={(event) => void saveField(field, { field_type: event.target.value as MeasurementField['field_type'] })}>
                          <option value="number">Number</option><option value="text">Text</option><option value="textarea">Long text</option>
                        </select>
                        <select className="measurement-config-field" aria-label={`${field.name} unit`} value={field.unit} disabled={!canConfigure} onChange={(event) => void saveField(field, { unit: event.target.value as MeasurementField['unit'] })}>
                          <option value="mm">mm</option><option value="cm">cm</option><option value="in">in</option><option value="mtr">Mtr</option>
                        </select>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                          <input type="checkbox" checked={field.required} disabled={!canConfigure} onChange={(event) => void saveField(field, { required: event.target.checked })} /> Required
                        </label>
                        {canConfigure && <>
                          <button type="button" className="btn sm" aria-label={`Move ${field.name} up`} disabled={fieldIndex === 0} onClick={() => void moveField(selectedTab, field, -1)}>↑</button>
                          <button type="button" className="btn sm" aria-label={`Move ${field.name} down`} disabled={fieldIndex === selectedTab.fields.length - 1} onClick={() => void moveField(selectedTab, field, 1)}>↓</button>
                          <button type="button" className="btn sm" onClick={() => void saveField(field, { enabled: !field.enabled })}>{field.enabled ? 'Disable' : 'Enable'}</button>
                        </>}
                        {!field.enabled && <span className="badge pending">Disabled</span>}
                      </div>
                    ))}
                  </div>
                  {canConfigure && (
                    <div style={{ padding: 16 }}>
                      <button type="button" className="btn sm pri" onClick={() => setShowFieldForm(true)}><IconPlus size={14} /> Add field</button>
                    </div>
                  )}
                </section>
              )
            )}
          </div>
        </div>
      )}

      {showFieldForm && selectedTab && canConfigure && (
        <Modal title={`Add field to ${selectedTab.name}`} onClose={() => setShowFieldForm(false)}>
          <form onSubmit={(event) => { event.preventDefault(); void addField(selectedTab); }}>
            <div style={gridStyle}>
              <div className="fld">
                <label htmlFor={`field-name-${selectedTab.id}`}>Field name</label>
                <input className="measurement-config-field" id={`field-name-${selectedTab.id}`} autoFocus value={fieldDrafts[selectedTab.id]?.name || ''} onChange={(event) => setFieldDrafts((current) => ({ ...current, [selectedTab.id]: { name: event.target.value, field_type: current[selectedTab.id]?.field_type || 'number', unit: current[selectedTab.id]?.unit || 'cm', required: current[selectedTab.id]?.required || false } }))} placeholder="e.g. Chest" required />
              </div>
              <div className="fld">
                <label htmlFor={`field-type-${selectedTab.id}`}>Input type</label>
                <select className="measurement-config-field" id={`field-type-${selectedTab.id}`} value={fieldDrafts[selectedTab.id]?.field_type || 'number'} onChange={(event) => setFieldDrafts((current) => ({ ...current, [selectedTab.id]: { name: current[selectedTab.id]?.name || '', field_type: event.target.value, unit: current[selectedTab.id]?.unit || 'cm', required: current[selectedTab.id]?.required || false } }))}>
                  <option value="number">Number</option><option value="text">Text</option><option value="textarea">Long text</option>
                </select>
              </div>
              <div className="fld">
                <label htmlFor={`field-unit-${selectedTab.id}`}>Unit</label>
                <select className="measurement-config-field" id={`field-unit-${selectedTab.id}`} value={fieldDrafts[selectedTab.id]?.unit || 'cm'} onChange={(event) => setFieldDrafts((current) => ({ ...current, [selectedTab.id]: { name: current[selectedTab.id]?.name || '', field_type: current[selectedTab.id]?.field_type || 'number', unit: event.target.value, required: current[selectedTab.id]?.required || false } }))}>
                  <option value="mm">mm</option><option value="cm">cm</option><option value="in">in</option><option value="mtr">Mtr</option>
                </select>
              </div>
            </div>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, margin: '4px 0 12px' }}>
              <input type="checkbox" checked={fieldDrafts[selectedTab.id]?.required || false} onChange={(event) => setFieldDrafts((current) => ({ ...current, [selectedTab.id]: { name: current[selectedTab.id]?.name || '', field_type: current[selectedTab.id]?.field_type || 'number', unit: current[selectedTab.id]?.unit || 'cm', required: event.target.checked } }))} />
              Required field
            </label>
            <div className="app-modal-actions">
              <button type="button" className="btn" onClick={() => setShowFieldForm(false)}>Cancel</button>
              <button type="submit" className="btn pri"><IconPlus size={14} /> Add field</button>
            </div>
          </form>
        </Modal>
      )}

      {orderDialogOpen && (
        <Modal
          title="Create a customer order"
          headerContent={
            <div className="order-creation-modal-heading">
              <h2>Create a customer order</h2>
              <div className="order-creation-header-fields">
                <div className="fld">
                  <label htmlFor="new-order-number">Order number</label>
                  <input id="new-order-number" form="create-customer-order-form" required maxLength={50} value={orderNumber} onChange={(event) => setOrderNumber(event.target.value)} />
                </div>
                <div className="fld">
                  <label htmlFor="new-order-date">Order date</label>
                  <input id="new-order-date" form="create-customer-order-form" type="date" required value={orderDate} onChange={(event) => setOrderDate(event.target.value)} />
                </div>
              </div>
            </div>
          }
          headerClassName="order-creation-modal-header"
          onClose={() => setOrderDialogOpen(false)}
          wide
          defaultFullScreen
        >
          <form id="create-customer-order-form" className="order-creation-form" onSubmit={createOrder}>
            <div className="order-creation-customer-fields">
              <div className="fld">
                <label htmlFor="order-customer-search">Find customer</label>
                <input
                  id="order-customer-search"
                  autoComplete="off"
                  placeholder="Find a customer by name or mobile number"
                  value={orderCustomerSearch}
                  onChange={(event) => {
                    setOrderCustomerSearch(event.target.value);
                    setCustomerId('');
                    setSelectedCustomer(null);
                    setMeasurementValues({});
                  }}
                />
              </div>
              {selectedCustomer ? (
                <div className="order-selected-customer">
                  <div>
                    <b>{selectedCustomer.name}</b>
                    <small>{selectedCustomer.phone_number}</small>
                  </div>
                  <button type="button" className="btn sm" onClick={() => { setCustomerId(''); setSelectedCustomer(null); setMeasurementValues({}); }}>Change</button>
                </div>
              ) : (
                <>
                  <div className="fld">
                    <label htmlFor="new-customer-name">Customer name</label>
                    <input id="new-customer-name" required minLength={2} value={newCustomer.name} onChange={(event) => setNewCustomer({ ...newCustomer, name: event.target.value })} />
                  </div>
                  <div className="fld">
                    <label htmlFor="new-customer-phone">Mobile number</label>
                    <input id="new-customer-phone" type="tel" required value={newCustomer.phone_number} onChange={(event) => setNewCustomer({ ...newCustomer, phone_number: event.target.value })} />
                  </div>
                </>
              )}
            </div>
            {orderCustomerResults.length > 0 && orderCustomerSearch.trim().length >= 2 && !customerId && (
              <div className="order-customer-results" style={{ display: 'grid', gap: 5, maxHeight: 190, overflowY: 'auto' }}>
                {orderCustomerResults.map((customer) => (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => {
                      setCustomerId(customer.id);
                      setSelectedCustomer(customer);
                      setOrderCustomerSearch('');
                      setOrderCustomerResults([]);
                      void loadCustomerMeasurementValues(customer.id)
                        .then(setMeasurementValues)
                        .catch(() => setMeasurementValues({}));
                    }}
                    style={{ textAlign: 'left', padding: '9px 12px', border: '1px solid var(--bd)', borderRadius: 9, background: 'var(--card)' }}
                  >
                    <b>{customer.name}</b>
                    <small style={{ display: 'block', color: 'var(--t2)' }}>{customer.phone_number}</small>
                  </button>
                ))}
              </div>
            )}
            {!selectedCustomer && orderCustomerSearch.trim().length >= 2 && orderCustomerResults.length === 0 && (
              <p className="order-customer-no-match" style={{ fontSize: 12, color: 'var(--t2)' }}>No match found. Enter the new customer's name and mobile number below; the customer record will be created with the order.</p>
            )}
            <div className={`order-creation-address-schedule-fields${selectedCustomer ? ' has-selected-customer' : ''}`}>
              {!selectedCustomer && (
                <div className="fld">
                  <label htmlFor="new-customer-address">Address (optional)</label>
                  <textarea id="new-customer-address" rows={2} value={newCustomer.address} onChange={(event) => setNewCustomer({ ...newCustomer, address: event.target.value })} />
                </div>
              )}
              <div className="fld">
                <label htmlFor="new-order-priority">Priority</label>
                <select
                  id="new-order-priority"
                  className={`priority-select priority-${priority}`}
                  value={priority}
                  onChange={(event) => setPriority(event.target.value as OrderPriority)}
                >
                  <option value="high">High</option>
                  <option value="normal">Normal</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div className="fld">
                <label htmlFor="new-order-due">Due date</label>
                <input id="new-order-due" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
              </div>
            </div>
            {enabledTabs.length > 0 && (
              <div className="order-measurements-section" style={{ borderTop: '1px solid var(--bd)' }}>
                <h3 style={{ fontSize: 15 }}>Customer measurements</h3>
                {loadingCustomerMeasurements ? (
                  <p style={{ color: 'var(--t2)' }}>Loading customer measurements…</p>
                ) : (
                  <MeasurementEditor
                    tabs={enabledTabs}
                    activeTabId={orderMeasurementTab?.id || ''}
                    onTabChange={setOrderMeasurementTabId}
                    values={measurementValues}
                    onChange={(fieldId, value) => setMeasurementValues((current) => ({ ...current, [fieldId]: value }))}
                    idPrefix="order-measurement"
                  />
                )}
              </div>
            )}
            <div className="order-creation-actions" style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={() => setOrderDialogOpen(false)}>Cancel</button>
              <button type="submit" className="btn pri" disabled={saving || loadingCustomerMeasurements || (!customerId && (!newCustomer.name.trim() || !newCustomer.phone_number.trim()))}>{saving ? 'Creating…' : 'Create order'}</button>
            </div>
          </form>
        </Modal>
      )}

      {customerDialogOpen && (
        <Modal title={customerEdit ? 'Edit customer' : 'Add customer'} onClose={() => setCustomerDialogOpen(false)}>
          <form onSubmit={saveCustomer}>
            <div className="fld"><label htmlFor="customer-name">Customer name</label><input id="customer-name" required minLength={2} value={customerForm.name} onChange={(event) => setCustomerForm({ ...customerForm, name: event.target.value })} /></div>
            <div className="fld"><label htmlFor="customer-phone">Phone number</label><input id="customer-phone" type="tel" required value={customerForm.phone_number} onChange={(event) => setCustomerForm({ ...customerForm, phone_number: event.target.value })} /></div>
            <div className="fld"><label htmlFor="customer-address">Address</label><textarea id="customer-address" rows={3} value={customerForm.address} onChange={(event) => setCustomerForm({ ...customerForm, address: event.target.value })} /></div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="btn" onClick={() => setCustomerDialogOpen(false)}>Cancel</button>
              <button type="submit" className="btn pri" disabled={customerFormSaving}>{customerFormSaving ? 'Saving…' : 'Save customer'}</button>
            </div>
          </form>
        </Modal>
      )}

      {customerMeasurementCustomer && (
        <Modal
          title={`Measurements · ${customerMeasurementCustomer.name}`}
          onClose={() => setCustomerMeasurementCustomer(null)}
          wide
          defaultFullScreen
        >
          <p style={{ color: 'var(--t2)', marginBottom: 14 }}>
            These are the customer's default measurements used as a starting template for new orders. Existing and past orders will not be changed.
          </p>
          {loadingCustomerMeasurements ? (
            <p style={{ color: 'var(--t2)' }}>Loading customer measurements…</p>
          ) : (
            <MeasurementEditor
              tabs={enabledTabs}
              activeTabId={customerMeasurementTab?.id || ''}
              onTabChange={setCustomerMeasurementTabId}
              values={customerMeasurementValues}
              onChange={(fieldId, value) => setCustomerMeasurementValues((current) => ({ ...current, [fieldId]: value }))}
              idPrefix="customer-master-measurement"
            />
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
            <button type="button" className="btn" onClick={() => setCustomerMeasurementCustomer(null)}>Close</button>
            <button type="button" className="btn pri" disabled={savingCustomerMeasurements || loadingCustomerMeasurements} onClick={() => void saveMeasurements()}>
              {savingCustomerMeasurements ? 'Saving…' : 'Save measurements'}
            </button>
          </div>
        </Modal>
      )}

      {selectedOrder && (
        <Modal
          title={selectedOrder.order_number}
          headerContent={
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800 }}>{selectedOrder.order_number}</h2>
              <span className={`badge ${selectedOrder.is_overdue ? 'overdue' : selectedOrder.status === 'delivered' ? 'active' : 'pending'}`} style={{ fontSize: '12px' }}>
                {selectedOrder.is_overdue ? 'Overdue' : labelForStatus(selectedOrder.status)}
              </span>
            </div>
          }
          onClose={() => setSelectedOrder(null)}
          wide
          defaultFullScreen
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '16px 20px', background: 'var(--soft)', borderRadius: '12px', marginBottom: 20 }}>
            <div>
              <b style={{ fontSize: '16px', color: 'var(--text)' }}>{selectedOrder.customer.name}</b>
              <div style={{ color: 'var(--t2)', marginTop: 3, fontSize: '13px' }}>📞 {selectedOrder.customer.phone_number}</div>
              {selectedOrder.customer.address && <div style={{ color: 'var(--t2)', fontSize: '12.5px', marginTop: 2 }}>📍 {selectedOrder.customer.address}</div>}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {nextStatus && selectedOrder.status !== 'cancelled' && selectedOrder.status !== 'delivered' && (
                <button type="button" className="btn pri sm" onClick={() => void changeStatus(nextStatus.value)}>Move to {nextStatus.label}</button>
              )}
              {selectedOrder.status !== 'cancelled' && (
                <button type="button" className="btn danger sm" onClick={() => void changeStatus('cancelled')}>Cancel order</button>
              )}
              <div style={{ position: 'relative', display: 'inline-flex' }} className="order-action-menu-container">
                <button
                  type="button"
                  className="btn sm"
                  aria-label="Order actions"
                  title="More actions"
                  style={{ padding: '0 8px', height: 32 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDetailMenuOpen((prev) => !prev);
                  }}
                >
                  <MoreVertical size={16} />
                </button>
                {detailMenuOpen && (
                  <div
                    className="dropdown-menu"
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: '100%',
                      marginTop: 4,
                      background: 'var(--card)',
                      border: '1px solid var(--bd)',
                      borderRadius: 8,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                      zIndex: 60,
                      minWidth: 150,
                      padding: 4,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                      textAlign: 'left',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        width: '100%',
                        padding: '8px 12px',
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--danger, #ef4444)',
                        fontSize: 13,
                        cursor: 'pointer',
                        borderRadius: 6,
                        textAlign: 'left',
                      }}
                      disabled={deletingOrderId === selectedOrder.id}
                      onClick={() => {
                        setDetailMenuOpen(false);
                        void deleteOrder(selectedOrder);
                      }}
                    >
                      <Trash2 size={14} /> {deletingOrderId === selectedOrder.id ? 'Deleting…' : 'Delete order'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '14px', alignItems: 'end', marginBottom: 20 }}>
            <div className="fld" style={{ margin: 0 }}>
              <label htmlFor="edit-order-number">Order number</label>
              <input id="edit-order-number" maxLength={50} value={orderNumber} onChange={(event) => setOrderNumber(event.target.value)} />
            </div>
            <div className="fld" style={{ margin: 0 }}>
              <label htmlFor="edit-order-date">Order date</label>
              <input id="edit-order-date" type="date" value={orderDate} onChange={(event) => setOrderDate(event.target.value)} />
            </div>
            <div className="fld" style={{ margin: 0 }}>
              <label htmlFor="edit-order-due">Due date</label>
              <input id="edit-order-due" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </div>
            <div className="fld" style={{ margin: 0 }}>
              <label htmlFor="edit-order-priority">Priority</label>
              <select id="edit-order-priority" className={`priority-select priority-${priority}`} value={priority} onChange={(event) => setPriority(event.target.value as OrderPriority)}>
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <button type="button" className="btn sm" style={{ height: '42px', width: '100%' }} onClick={() => void updateOrderDueDate()}>Save order details</button>
            </div>
          </div>

          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Measurements</h3>
          <div className="card" style={{ padding: 18, marginBottom: 24 }}>
            <MeasurementEditor
              tabs={enabledTabs}
              activeTabId={detailMeasurementTab?.id || ''}
              onTabChange={setDetailMeasurementTabId}
              values={detailMeasurementValues}
              onChange={(fieldId, value) => setDetailMeasurementValues((current) => ({ ...current, [fieldId]: value }))}
              idPrefix="order-detail-measurement"
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="button" className="btn pri sm" disabled={savingCustomerMeasurements} onClick={() => void saveMeasurements()}>
                {savingCustomerMeasurements ? 'Saving…' : 'Save order measurements'}
              </button>
            </div>
          </div>

          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Status timeline</h3>
          <div style={{ display: 'grid', gap: 0 }}>
            {selectedOrder.status_history.map((item, index) => (
              <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '20px 1fr', gap: 10, minHeight: 52 }}>
                <div style={{ display: 'flex', justifyContent: 'center' }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: index === selectedOrder.status_history.length - 1 ? 'var(--pri)' : 'var(--mut)', marginTop: 5 }} /></div>
                <div style={{ borderLeft: index === selectedOrder.status_history.length - 1 ? '0' : '1px solid var(--bd)', padding: '0 0 12px 4px' }}>
                  <b>{labelForStatus(item.new_status)}</b>
                  <small style={{ display: 'block', color: 'var(--t2)' }}>{new Date(item.changed_at).toLocaleString()} · {item.changed_by_name || 'Team member'}{item.reason ? ` · ${item.reason}` : ''}</small>
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
