import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { IconPlus } from '../../components/ui/Icons';
import { EditPlanModal, PlanItem } from './EditPlanModal';
import { CreatePlanModal } from './CreatePlanModal';
import { handleRecordRowClick, handleRecordRowKeyDown } from '../../utils/recordRow';

export function SubscriptionPlans() {
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanItem | null>(null);

  const { toast } = useToast();

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<PlanItem[]>('/platform/plans');
      setPlans(data);
    } catch (err: any) {
      toast(err.message || 'Failed to fetch plans', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const handleDelete = async (plan: PlanItem) => {
    if (!window.confirm(`Are you sure you want to permanently delete plan "${plan.name}"?`)) {
      return;
    }

    try {
      await apiRequest(`/platform/plans/${plan.id}`, { method: 'DELETE' });
      toast(`Plan "${plan.name}" deleted successfully`, 'success');
      fetchPlans();
    } catch (err: any) {
      toast(err.message || 'Cannot delete plan', 'error');
    }
  };

  return (
    <div className="anim-rise">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)' }}>
            Subscription Plans
          </h1>
          <p style={{ color: 'var(--t2)', fontSize: '13px', marginTop: '4px' }}>
            SaaS subscription tiers, member limits, and module access control
          </p>
        </div>

        <button onClick={() => setShowCreateModal(true)} className="btn pri">
          <IconPlus size={16} />
          <span>Create Plan</span>
        </button>
      </div>

      {loading && plans.length === 0 ? (
        <div className="card" aria-busy={loading} style={{ minHeight: 250, padding: '40px', textAlign: 'center', color: 'var(--t2)' }}>
          Loading subscription tiers...
        </div>
      ) : plans.length === 0 ? (
        <div className="card" aria-busy={loading} style={{ minHeight: 250, padding: '40px', textAlign: 'center', color: 'var(--t2)' }}>
          No subscription plans configured. Click "Create Plan" to add one.
        </div>
      ) : (
        <div aria-busy={loading} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '20px' }}>
          {plans.map((p) => (
            <div
              key={p.id}
              className="card record-card"
              role="group"
              aria-label={`Subscription plan ${p.name}. Activate to edit.`}
              tabIndex={0}
              onClick={(event) => handleRecordRowClick(event, () => setEditingPlan(p))}
              onKeyDown={(event) => handleRecordRowKeyDown(event, () => setEditingPlan(p))}
              style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span className={`badge ${p.is_active ? 'active' : 'suspended'}`}>
                  {p.code.toUpperCase()} {!p.is_active && '(Inactive)'}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--t2)', fontWeight: 600 }}>
                  Max {p.max_users} users
                </span>
              </div>

              <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '6px' }}>{p.name}</h3>
              <p style={{ color: 'var(--t2)', fontSize: '13px', marginBottom: '20px', flex: 1 }}>
                {p.description || 'Configured subscription tier for workshop tenants.'}
              </p>

              {/* Modules section */}
              <div style={{ borderTop: '1px solid var(--bd)', paddingTop: '14px', marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)', marginBottom: '8px' }}>
                  Included Modules
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {p.modules_allowed && Object.keys(p.modules_allowed).filter((m) => p.modules_allowed[m]).length > 0 ? (
                    Object.keys(p.modules_allowed)
                      .filter((m) => p.modules_allowed[m])
                      .map((m) => (
                        <span
                          key={m}
                          style={{
                            fontSize: '11px',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            background: 'var(--soft)',
                            color: 'var(--text)',
                            fontWeight: 600,
                          }}
                        >
                          ✓ {m}
                        </span>
                      ))
                  ) : (
                    <span style={{ fontSize: '11px', color: 'var(--t2)' }}>No modules assigned</span>
                  )}
                </div>
              </div>

              {/* Action Buttons: Edit and Delete */}
              <div style={{ borderTop: '1px solid var(--bd)', paddingTop: '14px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  onClick={() => setEditingPlan(p)}
                  className="btn sm"
                >
                  Edit Plan
                </button>
                <button
                  onClick={() => handleDelete(p)}
                  className="btn sm danger"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Plan Modal */}
      {editingPlan && (
        <EditPlanModal
          plan={editingPlan}
          onClose={() => setEditingPlan(null)}
          onSuccess={() => {
            setEditingPlan(null);
            fetchPlans();
          }}
        />
      )}

      {/* Create Plan Modal */}
      {showCreateModal && (
        <CreatePlanModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchPlans();
          }}
        />
      )}
    </div>
  );
}
