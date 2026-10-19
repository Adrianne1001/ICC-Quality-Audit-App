import React, { useState } from 'react';
import { Modal } from './Modal';
import { useAuth } from '../context/AuthContext';
import { UserCheck, Briefcase, Building, Clock, FileText } from 'lucide-react';

interface ProfileSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  isFirstTime?: boolean;
}

const DEPARTMENTS = [
  'Software Engineering',
  'Quality Assurance & Testing',
  'Product & UX Design',
  'DevOps & Cloud Infrastructure',
  'Customer Support & Success',
  'IT Operations & Security',
  'Human Resources',
  'Finance & Accounting',
  'Sales & Business Development',
];

export const ProfileSetupModal: React.FC<ProfileSetupModalProps> = ({
  isOpen,
  onClose,
  isFirstTime = false,
}) => {
  const { profile, updateProfile } = useAuth();

  const [department, setDepartment] = useState(profile?.department || DEPARTMENTS[0]);
  const [role, setRole] = useState(profile?.role || '');
  const [jobFunction, setJobFunction] = useState(profile?.jobFunction || '');
  const [yearsInRole, setYearsInRole] = useState(profile?.yearsInRole ?? 1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role.trim()) {
      setError('Please specify your current role/position.');
      return;
    }
    if (!jobFunction.trim()) {
      setError('Please describe your job functions and daily processes.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await updateProfile({
        department,
        role: role.trim(),
        jobFunction: jobFunction.trim(),
        yearsInRole: Number(yearsInRole),
      });
      onClose();
    } catch (err: any) {
      console.error('Failed to update profile:', err);
      setError(err?.message || 'Failed to save profile. Please retry.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isFirstTime ? () => {} : onClose}
      title={isFirstTime ? 'Complete Your Infosoft Profile' : 'Edit Employee Audit Profile'}
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {isFirstTime && (
          <div className="bg-blue-50 border border-blue-200 text-blue-800 text-xs p-3 rounded-lg flex items-center gap-2">
            <UserCheck className="w-4 h-4 shrink-0 text-blue-600" />
            <span>
              Welcome to the Infosoft Quality Audit platform. Please confirm your role details so the AI
              Audit Agent can tailor relevant quality standards and interview questions to your workflows.
            </span>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
            <Building className="w-3.5 h-3.5 text-slate-500" /> Department
          </label>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            {DEPARTMENTS.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
            <Briefcase className="w-3.5 h-3.5 text-slate-500" /> Role / Position
          </label>
          <input
            type="text"
            required
            maxLength={128}
            placeholder="e.g. Senior Backend Engineer / QA Lead"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-slate-500" /> Job Function & Daily Workflows
          </label>
          <textarea
            required
            rows={4}
            maxLength={2000}
            placeholder="Describe your primary responsibilities, core processes, SOPs you follow, tools you use, and deliverables..."
            value={jobFunction}
            onChange={(e) => setJobFunction(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 resize-none"
          />
          <span className="text-[10px] text-slate-400 text-right block mt-0.5">
            {jobFunction.length}/2000 characters
          </span>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-500" /> Years in Current Role
          </label>
          <input
            type="number"
            min={0}
            max={50}
            step={0.5}
            required
            value={yearsInRole}
            onChange={(e) => setYearsInRole(Number(e.target.value))}
            className="w-32 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
          {!isFirstTime && (
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-xs transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
