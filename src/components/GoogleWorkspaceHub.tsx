import React, { useState } from 'react';
import {
  Video,
  GraduationCap,
  Users,
  RefreshCw,
  Plus,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Phone,
  Mail,
  BookOpen,
} from 'lucide-react';

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; expires_in?: number; error?: string }) => void;
          }) => {
            requestAccessToken: (options?: { prompt?: string }) => void;
          };
        };
      };
    };
  }
}

const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/contacts',
  'https://www.googleapis.com/auth/contacts.readonly',
  'https://www.googleapis.com/auth/meetings.space.created',
  'https://www.googleapis.com/auth/meetings.space.readonly',
  'https://www.googleapis.com/auth/classroom.courses',
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.announcements',
  'https://www.googleapis.com/auth/classroom.rosters.readonly',
].join(' ');

// In-memory token cache per workspace-integration skill guidelines
let cachedAccessToken: string | null = null;
let cachedTokenExpiry = 0;

function loadGisScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Identity Services')));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });
}

interface ClassroomCourse {
  id: string;
  name: string;
  section?: string;
  enrollmentCode?: string;
  alternateLink?: string;
  courseState?: string;
}

interface MeetSpace {
  name: string;
  meetingUri: string;
  meetingCode: string;
}

interface GoogleContactItem {
  resourceName: string;
  displayName: string;
  email: string;
  phone: string;
}

export const GoogleWorkspaceHub: React.FC<{ roleLabel?: string }> = ({ roleLabel = 'Institute' }) => {
  const [activeTab, setActiveTab] = useState<'classroom' | 'meet' | 'contacts'>('classroom');
  const [connected, setConnected] = useState<boolean>(Boolean(cachedAccessToken && Date.now() < cachedTokenExpiry));
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Classroom State
  const [courses, setCourses] = useState<ClassroomCourse[]>([]);
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseSection, setNewCourseSection] = useState('Batch A1');

  // Google Meet State
  const [meetSpaces, setMeetSpaces] = useState<MeetSpace[]>([]);
  const [lookupMeetName, setLookupMeetName] = useState('');

  // Google Contacts State
  const [contacts, setContacts] = useState<GoogleContactItem[]>([]);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');

  // Confirmation Dialog State before mutating external Google Workspace data
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    description: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  const getValidAccessToken = async (forceConsent = false): Promise<string> => {
    if (!forceConsent && cachedAccessToken && Date.now() < cachedTokenExpiry - 30000) {
      return cachedAccessToken;
    }

    await loadGisScript();
    const clientId =
      import.meta.env.VITE_GOOGLE_CLIENT_ID ||
      (window as unknown as { __GOOGLE_CLIENT_ID__?: string }).__GOOGLE_CLIENT_ID__ ||
      '';

    if (!clientId) {
      throw new Error(
        'VITE_GOOGLE_CLIENT_ID is being provisioned. Refresh the page if you just enabled Google Workspace OAuth.'
      );
    }

    return new Promise((resolve, reject) => {
      const tokenClient = window.google!.accounts!.oauth2!.initTokenClient({
        client_id: clientId,
        scope: WORKSPACE_SCOPES,
        callback: (response) => {
          if (response.error || !response.access_token) {
            reject(new Error(response.error || 'Failed to obtain Google Workspace access token'));
            return;
          }
          cachedAccessToken = response.access_token;
          cachedTokenExpiry = Date.now() + (response.expires_in ?? 3600) * 1000;
          setConnected(true);
          resolve(response.access_token);
        },
      });
      tokenClient.requestAccessToken({ prompt: forceConsent || !cachedAccessToken ? 'consent' : '' });
    });
  };

  // 1. Google Classroom API calls
  const fetchClassroomCourses = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const token = await getValidAccessToken();
      const res = await fetch('https://classroom.googleapis.com/v1/courses?pageSize=20', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        cachedAccessToken = null;
        throw new Error('Session expired. Please click Connect Google Workspace again.');
      }
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to fetch Google Classroom courses');
      }
      setCourses(data.courses || []);
      setStatusMsg(`Loaded ${(data.courses || []).length} courses from Google Classroom.`);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Classroom API error');
    } finally {
      setLoading(false);
    }
  };

  const executeCreateClassroomCourse = async () => {
    if (!newCourseName.trim()) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const token = await getValidAccessToken();
      const res = await fetch('https://classroom.googleapis.com/v1/courses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newCourseName.trim(),
          section: newCourseSection.trim() || 'Main Branch',
          ownerId: 'me',
          courseState: 'PROVISIONED',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Could not create Classroom course');
      }
      setCourses((prev) => [data, ...prev]);
      setNewCourseName('');
      setStatusMsg(`Created course "${data.name}" in Google Classroom.`);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create course');
    } finally {
      setLoading(false);
    }
  };

  // 2. Google Meet API calls
  const executeCreateMeetSpace = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const token = await getValidAccessToken();
      const res = await fetch('https://meet.googleapis.com/v2/spaces', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to create Google Meet space');
      }
      const createdSpace: MeetSpace = {
        name: data.name || 'spaces/new',
        meetingUri: data.meetingUri || '',
        meetingCode: data.meetingCode || '',
      };
      setMeetSpaces((prev) => [createdSpace, ...prev]);
      setStatusMsg(`Created live Google Meet room: ${createdSpace.meetingCode}`);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Google Meet API error');
    } finally {
      setLoading(false);
    }
  };

  const fetchMeetSpaceDetails = async () => {
    if (!lookupMeetName.trim()) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const token = await getValidAccessToken();
      const cleanName = lookupMeetName.trim().startsWith('spaces/')
        ? lookupMeetName.trim()
        : `spaces/${lookupMeetName.trim()}`;
      const res = await fetch(`https://meet.googleapis.com/v2/${cleanName}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Meet space not found');
      }
      const space: MeetSpace = {
        name: data.name,
        meetingUri: data.meetingUri,
        meetingCode: data.meetingCode,
      };
      setMeetSpaces((prev) => [space, ...prev.filter((s) => s.name !== space.name)]);
      setStatusMsg(`Loaded Google Meet space ${space.meetingCode}`);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to fetch Meet space');
    } finally {
      setLoading(false);
    }
  };

  // 3. Google Contacts (People API) calls
  const fetchGoogleContacts = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const token = await getValidAccessToken();
      const res = await fetch(
        'https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,phoneNumbers&pageSize=30',
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to load Google Contacts');
      }
      const parsed: GoogleContactItem[] = (data.connections || []).map(
        (c: {
          resourceName?: string;
          names?: { displayName?: string }[];
          emailAddresses?: { value?: string }[];
          phoneNumbers?: { value?: string }[];
        }) => ({
          resourceName: c.resourceName || '',
          displayName: c.names?.[0]?.displayName || 'Unnamed Contact',
          email: c.emailAddresses?.[0]?.value || '-',
          phone: c.phoneNumbers?.[0]?.value || '-',
        })
      );
      setContacts(parsed);
      setStatusMsg(`Synced ${parsed.length} contacts from Google Contacts.`);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Google Contacts API error');
    } finally {
      setLoading(false);
    }
  };

  const executeCreateGoogleContact = async () => {
    if (!newContactName.trim()) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const token = await getValidAccessToken();
      const res = await fetch('https://people.googleapis.com/v1/people:createContact', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          names: [{ givenName: newContactName.trim() }],
          phoneNumbers: newContactPhone.trim() ? [{ value: newContactPhone.trim() }] : [],
          emailAddresses: newContactEmail.trim() ? [{ value: newContactEmail.trim() }] : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to save contact');
      }
      const created: GoogleContactItem = {
        resourceName: data.resourceName || `people/${Date.now()}`,
        displayName: data.names?.[0]?.displayName || newContactName.trim(),
        email: data.emailAddresses?.[0]?.value || newContactEmail.trim() || '-',
        phone: data.phoneNumbers?.[0]?.value || newContactPhone.trim() || '-',
      };
      setContacts((prev) => [created, ...prev]);
      setNewContactName('');
      setNewContactPhone('');
      setNewContactEmail('');
      setStatusMsg(`Saved "${created.displayName}" to Google Contacts.`);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create Google Contact');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="waterfall-card rounded-3xl p-5 border border-[#90E0EF] shadow-md space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#00B4D8]/20 pb-3">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#0077B6]">
            Google Workspace • Classroom • Meet • Contacts
          </span>
          <h3 className="font-display font-extrabold text-base text-[#03045E]">
            {roleLabel} Google Workspace Tools
          </h3>
        </div>

        <button
          type="button"
          onClick={async () => {
            setErrorMsg(null);
            try {
              await getValidAccessToken(true);
              setStatusMsg('Google Workspace authorization active.');
            } catch (e: unknown) {
              setErrorMsg(e instanceof Error ? e.message : 'Authorization cancelled');
            }
          }}
          className={`px-3.5 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer ${
            connected
              ? 'bg-emerald-600 text-white'
              : 'bg-gradient-to-r from-[#0077B6] to-[#00B4D8] text-white hover:from-[#023E8A]'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>{connected ? 'Workspace Connected' : 'Authorize Workspace Tools'}</span>
        </button>
      </div>

      {/* Sub-navigation for Classroom, Meet, Contacts */}
      <div className="grid grid-cols-3 gap-2 bg-[#CAF0F8]/60 p-1.5 rounded-2xl border border-[#90E0EF]">
        <button
          type="button"
          onClick={() => setActiveTab('classroom')}
          className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
            activeTab === 'classroom'
              ? 'bg-[#0077B6] text-white shadow'
              : 'text-[#03045E] hover:bg-white/60'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          <span>Classroom</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('meet')}
          className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
            activeTab === 'meet'
              ? 'bg-[#0077B6] text-white shadow'
              : 'text-[#03045E] hover:bg-white/60'
          }`}
        >
          <Video className="w-4 h-4" />
          <span>Google Meet</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('contacts')}
          className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
            activeTab === 'contacts'
              ? 'bg-[#0077B6] text-white shadow'
              : 'text-[#03045E] hover:bg-white/60'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Contacts</span>
        </button>
      </div>

      {statusMsg && (
        <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{statusMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* TAB 1: GOOGLE CLASSROOM */}
      {activeTab === 'classroom' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-600 font-medium">
              Sync courses, coursework, and rosters directly with Google Classroom.
            </p>
            <button
              type="button"
              onClick={fetchClassroomCourses}
              disabled={loading}
              className="px-3 py-1.5 rounded-xl bg-[#0077B6] hover:bg-[#023E8A] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Sync Classroom Courses</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
            <input
              type="text"
              value={newCourseName}
              onChange={(e) => setNewCourseName(e.target.value)}
              placeholder="New Classroom Course (e.g. ADCA Batch A1)"
              className="sm:col-span-2 px-3 py-2 rounded-xl bg-white border border-[#90E0EF] text-xs text-[#03045E]"
            />
            <button
              type="button"
              onClick={() => {
                if (!newCourseName.trim()) return;
                setConfirmAction({
                  title: 'Create Google Classroom Course',
                  description: `Are you sure you want to create the course "${newCourseName.trim()}" (${newCourseSection}) in your Google Classroom account?`,
                  onConfirm: executeCreateClassroomCourse,
                });
              }}
              className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Course</span>
            </button>
          </div>

          {courses.length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto pt-1">
              {courses.map((c) => (
                <div
                  key={c.id}
                  className="p-3 rounded-2xl bg-white border border-[#90E0EF] flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2.5">
                    <BookOpen className="w-4 h-4 text-[#0077B6] shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-[#03045E]">{c.name}</div>
                      <div className="text-[10px] text-slate-500">
                        Section: {c.section || 'General'} • Code: {c.enrollmentCode || 'N/A'}
                      </div>
                    </div>
                  </div>
                  {c.alternateLink && (
                    <a
                      href={c.alternateLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-bold text-[#0077B6] hover:underline flex items-center gap-1"
                    >
                      <span>Open</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: GOOGLE MEET */}
      {activeTab === 'meet' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-600 font-medium">
              Generate live Google Meet video classroom links for online batches & doubt sessions.
            </p>
            <button
              type="button"
              onClick={() =>
                setConfirmAction({
                  title: 'Create Google Meet Space',
                  description:
                    'Are you sure you want to create a new Google Meet conference space in your Google Workspace account?',
                  onConfirm: executeCreateMeetSpace,
                })
              }
              disabled={loading}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Video className="w-3.5 h-3.5" />
              <span>New Google Meet Link</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={lookupMeetName}
              onChange={(e) => setLookupMeetName(e.target.value)}
              placeholder="Lookup Meet space ID (e.g. spaces/xxxx)"
              className="flex-1 px-3 py-2 rounded-xl bg-white border border-[#90E0EF] text-xs text-[#03045E]"
            />
            <button
              type="button"
              onClick={fetchMeetSpaceDetails}
              className="px-3 py-2 rounded-xl bg-[#0077B6] text-white text-xs font-bold cursor-pointer"
            >
              Lookup
            </button>
          </div>

          {meetSpaces.length > 0 && (
            <div className="space-y-2">
              {meetSpaces.map((m) => (
                <div
                  key={m.name}
                  className="p-3 rounded-2xl bg-white border border-[#90E0EF] flex items-center justify-between gap-2"
                >
                  <div>
                    <div className="text-xs font-bold text-[#03045E]">
                      Meet Code: <span className="font-mono text-[#0077B6]">{m.meetingCode}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">{m.name}</div>
                  </div>
                  {m.meetingUri && (
                    <a
                      href={m.meetingUri}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-[#0077B6] text-white text-xs font-bold flex items-center gap-1"
                    >
                      <span>Join Meet</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: GOOGLE CONTACTS */}
      {activeTab === 'contacts' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-600 font-medium">
              Sync student, guardian, and faculty phonebooks with Google Contacts.
            </p>
            <button
              type="button"
              onClick={fetchGoogleContacts}
              disabled={loading}
              className="px-3 py-1.5 rounded-xl bg-[#0077B6] hover:bg-[#023E8A] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Load Contacts</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <input
              type="text"
              value={newContactName}
              onChange={(e) => setNewContactName(e.target.value)}
              placeholder="Full Name"
              className="px-3 py-2 rounded-xl bg-white border border-[#90E0EF] text-xs text-[#03045E]"
            />
            <input
              type="text"
              value={newContactPhone}
              onChange={(e) => setNewContactPhone(e.target.value)}
              placeholder="Phone Number"
              className="px-3 py-2 rounded-xl bg-white border border-[#90E0EF] text-xs text-[#03045E]"
            />
            <input
              type="email"
              value={newContactEmail}
              onChange={(e) => setNewContactEmail(e.target.value)}
              placeholder="Email Address"
              className="px-3 py-2 rounded-xl bg-white border border-[#90E0EF] text-xs text-[#03045E]"
            />
            <button
              type="button"
              onClick={() => {
                if (!newContactName.trim()) return;
                setConfirmAction({
                  title: 'Save New Google Contact',
                  description: `Save "${newContactName.trim()}" (${newContactPhone || 'no phone'}) to your Google Contacts?`,
                  onConfirm: executeCreateGoogleContact,
                });
              }}
              className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Contact</span>
            </button>
          </div>

          {contacts.length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto pt-1">
              {contacts.map((c) => (
                <div
                  key={c.resourceName}
                  className="p-2.5 rounded-2xl bg-white border border-[#90E0EF] flex items-center justify-between gap-2 text-xs"
                >
                  <div className="font-bold text-[#03045E]">{c.displayName}</div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-600">
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-[#0077B6]" />
                      {c.phone}
                    </span>
                    <span className="hidden sm:flex items-center gap-1">
                      <Mail className="w-3 h-3 text-[#0077B6]" />
                      {c.email}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal for Workspace Mutating Actions */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="waterfall-card rounded-3xl max-w-md w-full p-6 text-[#03045E] shadow-2xl space-y-4">
            <h4 className="font-display font-bold text-base text-[#03045E]">{confirmAction.title}</h4>
            <p className="text-xs text-slate-600 leading-relaxed">{confirmAction.description}</p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const fn = confirmAction.onConfirm;
                  setConfirmAction(null);
                  await fn();
                }}
                className="px-4 py-2 rounded-full bg-[#0077B6] hover:bg-[#023E8A] text-white text-xs font-bold cursor-pointer"
              >
                Confirm & Execute
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
