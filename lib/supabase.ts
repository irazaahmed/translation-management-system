import { supabase } from "./supabaseClient";

// ============================================
// Types: Languages
// ============================================

export type WorkStatus = 'not_started' | 'in_progress' | 'completed';

export interface Language {
  id: string;
  country: string;
  language: string;
  responsible_person: string | null;
  priority: "low" | "medium" | "high" | null;
  work_status: WorkStatus;
  last_meeting_at: string | null;
  created_at: string;
  updated_at: string;
  project_id: string | null;
}

export interface CreateLanguageInput {
  country: string;
  language: string;
  responsible_person?: string | null;
  priority?: "low" | "medium" | "high" | null;
  work_status?: WorkStatus;
  project_id?: string;
}

export interface UpdateLanguageInput {
  country?: string;
  language?: string;
  responsible_person?: string | null;
  priority?: "low" | "medium" | "high" | null;
  work_status?: WorkStatus;
}

// ============================================
// Types: Projects
// ============================================

export interface Project {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface CreateProjectInput {
  name: string;
  description?: string | null;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string | null;
}

// Extended Language with project data
export interface LanguageWithProject extends Language {
  project?: Project;
}

// ============================================
// Types: Meetings
// ============================================

export interface Meeting {
  id: string;
  language_id: string;
  meeting_date: string;
  meeting_type: string | null;
  participants: string | null;
  discussion_points: string | null;
  translation_progress: string | null;
  progress_percentage: number | null;
  action_items: string | null;
  next_meeting_date: string | null;
  meeting_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateMeetingInput {
  language_id: string;
  meeting_date: string;
  meeting_type?: string | null;
  participants?: string | null;
  discussion_points?: string | null;
  translation_progress?: string | null;
  progress_percentage?: number | null;
  action_items?: string | null;
  next_meeting_date?: string | null;
  meeting_notes?: string | null;
}

export interface UpdateMeetingInput {
  meeting_date?: string;
  meeting_type?: string | null;
  participants?: string | null;
  discussion_points?: string | null;
  translation_progress?: string | null;
  progress_percentage?: number | null;
  action_items?: string | null;
  next_meeting_date?: string | null;
  meeting_notes?: string | null;
}

// ============================================
// Functions: Languages
// ============================================

/**
 * Fetch all languages from the database - OPTIMIZED
 * Selects only required fields instead of *
 * Sorted alphabetically by language name (A-Z)
 */
export async function getAllLanguages(): Promise<Language[]> {
  try {
    const { data, error } = await supabase
      .from("languages")
      .select(`
        id,
        country,
        language,
        responsible_person,
        priority,
        work_status,
        last_meeting_at,
        project_id,
        created_at,
        updated_at
      `)
      .order("language", { ascending: true });

    if (error) {
      console.error("Supabase error:", error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error("Error fetching languages:", error);
    throw error;
  }
}

/**
 * Fetch languages that haven't had a meeting in the specified number of days - OPTIMIZED
 * Only includes languages with work_status = 'in_progress'
 * Selects only required fields
 */
export async function getStaleLanguages(days: number = 7): Promise<Language[]> {
  try {
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - days);

    const { data, error } = await supabase
      .from("languages")
      .select(`
        id,
        country,
        language,
        responsible_person,
        priority,
        work_status,
        last_meeting_at,
        project_id,
        created_at,
        updated_at
      `)
      .eq("work_status", "in_progress")
      .or(`last_meeting_at.is.null,last_meeting_at.lt.${daysAgo.toISOString()}`)
      .order("last_meeting_at", { ascending: true, nullsFirst: true });

    if (error) {
      console.error("Supabase error:", error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error("Error fetching stale languages:", error);
    throw error;
  }
}

// NOTE: Write operations (createLanguage / updateLanguage / deleteLanguage /
// createMeeting / updateMeeting / deleteMeeting) live in lib/mutations.ts
// (server-only) so RLS can enforce roles via the authenticated client.

/**
 * Get a single language by ID
 */
export async function getLanguageById(id: string): Promise<LanguageWithProject | null> {
  try {
    const { data, error } = await supabase
      .from("languages")
      .select(`
        *,
        projects:project_id (
          id,
          name,
          description,
          created_at
        )
      `)
      .eq("id", id)
      .single();

    if (error) throw error;

    return {
      id: data.id,
      country: data.country,
      language: data.language,
      responsible_person: data.responsible_person,
      priority: data.priority,
      work_status: data.work_status,
      last_meeting_at: data.last_meeting_at,
      created_at: data.created_at,
      updated_at: data.updated_at,
      project_id: data.project_id,
      project: data.projects ? (data.projects as Project) : undefined,
    };
  } catch (error) {
    console.error("Error fetching language:", error);
    throw error;
  }
}

// ============================================
// Functions: Projects
// ============================================

/**
 * Fetch all projects from the database - OPTIMIZED
 * Selects only required fields
 */
export async function getAllProjects(): Promise<Project[]> {
  try {
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, description, created_at")
      .order("name", { ascending: true });

    if (error) {
      console.error("Supabase error:", error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error("Error fetching projects:", error);
    throw error;
  }
}

/**
 * Get a single project by ID
 */
export async function getProjectById(id: string): Promise<Project | null> {
  try {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error fetching project:", error);
    throw error;
  }
}

/**
 * Search languages by name, country, or responsible person
 */
export async function searchLanguages(query: string): Promise<LanguageWithProject[]> {
  try {
    const { data, error } = await supabase
      .from("languages")
      .select(`
        *,
        projects:project_id ( id, name, description, created_at )
      `)
      .or(
        `language.ilike.%${query}%,country.ilike.%${query}%,responsible_person.ilike.%${query}%`
      )
      .order("language", { ascending: true })
      .limit(30);

    if (error) throw error;

    return (data || []).map((row: any) => ({
      id: row.id,
      country: row.country,
      language: row.language,
      responsible_person: row.responsible_person,
      priority: row.priority,
      work_status: row.work_status,
      last_meeting_at: row.last_meeting_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
      project_id: row.project_id,
      project: row.projects ? (row.projects as Project) : undefined,
    }));
  } catch (error) {
    console.error("Error searching languages:", error);
    throw error;
  }
}

/**
 * Fetch languages for a specific project
 */
export async function getLanguagesByProject(projectId: string): Promise<Language[]> {
  try {
    const { data, error } = await supabase
      .from("languages")
      .select("*")
      .eq("project_id", projectId)
      .order("language", { ascending: true });

    if (error) {
      console.error("Supabase error:", error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error("Error fetching languages by project:", error);
    throw error;
  }
}

/**
 * Fetch all languages with their project data
 */
export async function getAllLanguagesWithProject(): Promise<LanguageWithProject[]> {
  try {
    const { data, error } = await supabase
      .from("languages")
      .select(`
        *,
        projects:project_id (
          id,
          name,
          description,
          created_at
        )
      `)
      .order("language", { ascending: true });

    if (error) {
      console.error("Supabase error:", error);
      throw error;
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      country: row.country,
      language: row.language,
      responsible_person: row.responsible_person,
      priority: row.priority,
      work_status: row.work_status,
      last_meeting_at: row.last_meeting_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
      project_id: row.project_id,
      project: row.projects ? (row.projects as Project) : undefined,
    }));
  } catch (error) {
    console.error("Error fetching languages with project:", error);
    throw error;
  }
}

/**
 * Get dashboard statistics grouped by project - OPTIMIZED with single query
 * Uses a single query with JOINs instead of N+1 queries
 */
export interface ProjectStats {
  project: Project;
  totalLanguages: number;
  inProgress: number;
  completed: number;
  notStarted: number;
  meetingsThisWeek: number;
  /** In-progress languages with no meeting in the last 14 days. */
  needsAttention: number;
}

export async function getProjectStats(): Promise<ProjectStats[]> {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Single query with JOINs to fetch all data at once
    const { data, error } = await supabase
      .from("projects")
      .select(`
        id,
        name,
        description,
        created_at,
        languages (
          id,
          work_status,
          last_meeting_at,
          meetings (
            meeting_date
          )
        )
      `);

    if (error) throw error;

    const stats: ProjectStats[] = [];

    for (const project of data || []) {
      const languages = project.languages || [];
      
      // Calculate meetings this week from nested data
      let meetingsThisWeek = 0;
      languages.forEach(lang => {
        const meetings = lang.meetings || [];
        meetings.forEach(meeting => {
          if (new Date(meeting.meeting_date) >= sevenDaysAgo) {
            meetingsThisWeek++;
          }
        });
      });

      const projectStat: ProjectStats = {
        project: {
          id: project.id,
          name: project.name,
          description: project.description,
          created_at: project.created_at,
        },
        totalLanguages: languages.length,
        inProgress: languages.filter(l => l.work_status === 'in_progress').length,
        completed: languages.filter(l => l.work_status === 'completed').length,
        notStarted: languages.filter(l => l.work_status === 'not_started').length,
        meetingsThisWeek,
        needsAttention: languages.filter(l =>
          l.work_status === 'in_progress' &&
          (!l.last_meeting_at || new Date(l.last_meeting_at) < fourteenDaysAgo)
        ).length,
      };

      stats.push(projectStat);
    }

    return stats;
  } catch (error) {
    console.error("Error fetching project stats:", error);
    throw error;
  }
}

// ============================================
// Functions: Meetings
// ============================================

/**
 * Fetch all meetings from the database
 */
export async function getAllMeetings(): Promise<Meeting[]> {
  try {
    const { data, error } = await supabase
      .from("meetings")
      .select("*")
      .order("meeting_date", { ascending: false });

    if (error) {
      console.error("Supabase error:", error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error("Error fetching meetings:", error);
    throw error;
  }
}

/**
 * Fetch meetings for a specific language
 */
export async function getMeetingsByLanguage(
  languageId: string
): Promise<Meeting[]> {
  try {
    const { data, error } = await supabase
      .from("meetings")
      .select("*")
      .eq("language_id", languageId)
      .order("meeting_date", { ascending: false });

    if (error) {
      console.error("Supabase error:", error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error("Error fetching meetings by language:", error);
    throw error;
  }
}

/**
 * Get a single meeting by ID
 */
export async function getMeetingById(id: string): Promise<Meeting | null> {
  try {
    const { data, error } = await supabase
      .from("meetings")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error fetching meeting:", error);
    throw error;
  }
}

/**
 * Get the most recent meeting for a language
 */
export async function getLatestMeetingByLanguage(
  languageId: string
): Promise<Meeting | null> {
  try {
    const { data, error } = await supabase
      .from("meetings")
      .select("*")
      .eq("language_id", languageId)
      .order("meeting_date", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") throw error; // PGRST116 = no rows returned
    return data || null;
  } catch (error) {
    console.error("Error fetching latest meeting:", error);
    throw error;
  }
}

/**
 * Search meetings by participants, discussion points, next action, or language name
 */
export interface MeetingWithLanguage {
  meeting: Meeting;
  language: Language | null;
}

export async function searchMeetings(query: string): Promise<MeetingWithLanguage[]> {
  try {
    // First, search meetings by text fields
    const { data: meetingsData, error: meetingsError } = await supabase
      .from("meetings")
      .select("*")
      .or(
        `participants.ilike.%${query}%,discussion_points.ilike.%${query}%,action_items.ilike.%${query}%`
      )
      .order("meeting_date", { ascending: false })
      .limit(20);

    if (meetingsError) throw meetingsError;

    // Also search by language name
    const { data: languagesData, error: languagesError } = await supabase
      .from("languages")
      .select("id")
      .ilike("language", `%${query}%`);

    if (languagesError) throw languagesError;

    // Get meetings for matching languages
    let languageMeetings: Meeting[] = [];
    if (languagesData && languagesData.length > 0) {
      const languageIds = languagesData.map((lang) => lang.id);
      const { data: langMeetingsData, error: langMeetingsError } = await supabase
        .from("meetings")
        .select("*")
        .in("language_id", languageIds)
        .order("meeting_date", { ascending: false });

      if (langMeetingsError) throw langMeetingsError;
      languageMeetings = langMeetingsData || [];
    }

    // Combine and deduplicate results
    const allMeetings = [...(meetingsData || []), ...languageMeetings];
    const uniqueMeetings = allMeetings.filter(
      (meeting, index, self) => index === self.findIndex((m) => m.id === meeting.id)
    );

    // Enrich with language data (single batched query instead of N queries)
    const languageMap = await getLanguagesByIds([
      ...new Set(uniqueMeetings.map((m) => m.language_id)),
    ]);
    const meetingsWithLanguage: MeetingWithLanguage[] = uniqueMeetings.map((meeting) => ({
      meeting,
      language: languageMap.get(meeting.language_id) || null,
    }));

    return meetingsWithLanguage;
  } catch (error) {
    console.error("Error searching meetings:", error);
    throw error;
  }
}

/**
 * Get recent meetings with language data using a JOIN - OPTIMIZED
 * Selects only required fields instead of *
 */
export async function getRecentMeetings(limit: number = 20): Promise<MeetingWithLanguage[]> {
  try {
    const { data: meetingsData, error } = await supabase
      .from("meetings")
      .select(`
        id,
        language_id,
        meeting_date,
        meeting_type,
        participants,
        discussion_points,
        action_items,
        created_at,
        languages:language_id (
          id,
          country,
          language,
          responsible_person,
          priority,
          work_status
        )
      `)
      .order("meeting_date", { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (meetingsData || []).map((row: any) => ({
      meeting: {
        id: row.id,
        language_id: row.language_id,
        meeting_date: row.meeting_date,
        meeting_type: row.meeting_type,
        participants: row.participants,
        discussion_points: row.discussion_points,
        translation_progress: row.translation_progress || null,
        progress_percentage: row.progress_percentage || null,
        action_items: row.action_items,
        next_meeting_date: row.next_meeting_date || null,
        meeting_notes: row.meeting_notes || null,
        created_at: row.created_at,
        updated_at: row.updated_at || "",
      },
      language: row.languages as Language,
    }));
  } catch (error) {
    console.error("Error fetching recent meetings:", error);
    throw error;
  }
}

/**
 * Get upcoming meetings (next_meeting_date today or later), soonest first.
 */
export async function getUpcomingMeetings(limit: number = 10): Promise<MeetingWithLanguage[]> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from("meetings")
      .select(`
        id,
        language_id,
        meeting_date,
        next_meeting_date,
        participants,
        action_items,
        created_at,
        languages:language_id (
          id, country, language, responsible_person, priority, work_status
        )
      `)
      .gte("next_meeting_date", today.toISOString().slice(0, 10))
      .order("next_meeting_date", { ascending: true })
      .limit(limit);

    if (error) throw error;

    return (data || []).map((row: any) => ({
      meeting: {
        id: row.id,
        language_id: row.language_id,
        meeting_date: row.meeting_date,
        meeting_type: null,
        participants: row.participants,
        discussion_points: null,
        translation_progress: null,
        progress_percentage: null,
        action_items: row.action_items,
        next_meeting_date: row.next_meeting_date,
        meeting_notes: null,
        created_at: row.created_at,
        updated_at: "",
      },
      language: row.languages as Language,
    }));
  } catch (error) {
    console.error("Error fetching upcoming meetings:", error);
    throw error;
  }
}

/**
 * Get all meetings with language data using a JOIN
 */
export async function getAllMeetingsWithLanguage(): Promise<MeetingWithLanguage[]> {
  try {
    const { data: meetingsData, error } = await supabase
      .from("meetings")
      .select(`
        *,
        languages:language_id (
          id,
          country,
          language,
          responsible_person,
          priority,
          work_status,
          last_meeting_at,
          project_id,
          created_at,
          updated_at
        )
      `)
      .order("meeting_date", { ascending: false });

    if (error) throw error;

    return (meetingsData || []).map((row: any) => ({
      meeting: {
        id: row.id,
        language_id: row.language_id,
        meeting_date: row.meeting_date,
        meeting_type: row.meeting_type,
        participants: row.participants,
        discussion_points: row.discussion_points,
        translation_progress: row.translation_progress,
        progress_percentage: row.progress_percentage,
        action_items: row.action_items,
        next_meeting_date: row.next_meeting_date,
        meeting_notes: row.meeting_notes,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
      language: row.languages as Language,
    }));
  } catch (error) {
    console.error("Error fetching all meetings with language:", error);
    throw error;
  }
}

/**
 * Batch-fetch languages by IDs in a single query and return them as a Map.
 * Replaces per-language getLanguageById() calls in reports (avoids N+1).
 */
export async function getLanguagesByIds(
  ids: string[]
): Promise<Map<string, LanguageWithProject>> {
  const map = new Map<string, LanguageWithProject>();
  if (ids.length === 0) return map;

  const { data, error } = await supabase
    .from("languages")
    .select(`
      *,
      projects:project_id ( id, name, description, created_at )
    `)
    .in("id", ids);

  if (error) throw error;

  (data || []).forEach((row: any) => {
    map.set(row.id, {
      id: row.id,
      country: row.country,
      language: row.language,
      responsible_person: row.responsible_person,
      priority: row.priority,
      work_status: row.work_status,
      last_meeting_at: row.last_meeting_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
      project_id: row.project_id,
      project: row.projects ? (row.projects as Project) : undefined,
    });
  });

  return map;
}

/**
 * Get weekly report data - meetings from the last 7 days grouped by language
 */
export interface WeeklyReportData {
  weekStart: Date;
  weekEnd: Date;
  totalMeetings: number;
  totalLanguages: number;
  languagesWithMeetings: Array<{
    language: Language;
    meetings: Meeting[];
  }>;
}

export async function getWeeklyReport(): Promise<WeeklyReportData> {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Fetch meetings from the last 7 days
    const { data: meetingsData, error: meetingsError } = await supabase
      .from("meetings")
      .select("*")
      .gte("meeting_date", sevenDaysAgo.toISOString())
      .order("meeting_date", { ascending: false });

    if (meetingsError) throw meetingsError;

    const meetings = meetingsData || [];

    // Group meetings by language
    const meetingsByLanguage = new Map<string, Meeting[]>();
    const languageIds = new Set<string>();

    meetings.forEach((meeting) => {
      languageIds.add(meeting.language_id);
      const existing = meetingsByLanguage.get(meeting.language_id) || [];
      existing.push(meeting);
      meetingsByLanguage.set(meeting.language_id, existing);
    });

    // Fetch language details
    const languagesWithMeetings: WeeklyReportData["languagesWithMeetings"] = [];

    const languageMap = await getLanguagesByIds([...meetingsByLanguage.keys()]);
    for (const [languageId, langMeetings] of meetingsByLanguage.entries()) {
      const language = languageMap.get(languageId);
      if (language) {
        languagesWithMeetings.push({
          language,
          meetings: langMeetings.sort((a, b) =>
            new Date(b.meeting_date).getTime() - new Date(a.meeting_date).getTime()
          ),
        });
      }
    }

    // Sort languages alphabetically
    languagesWithMeetings.sort((a, b) =>
      a.language.language.localeCompare(b.language.language)
    );

    return {
      weekStart: sevenDaysAgo,
      weekEnd: now,
      totalMeetings: meetings.length,
      totalLanguages: languagesWithMeetings.length,
      languagesWithMeetings,
    };
  } catch (error) {
    console.error("Error fetching weekly report:", error);
    throw error;
  }
}

/**
 * Get monthly report data - meetings from the last 30 days grouped by language
 */
export interface MonthlyReportData {
  monthStart: Date;
  monthEnd: Date;
  totalMeetings: number;
  totalLanguages: number;
  languagesWithMeetings: Array<{
    language: Language;
    meetings: Meeting[];
  }>;
}

export async function getMonthlyReport(): Promise<MonthlyReportData> {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Fetch meetings from the last 30 days
    const { data: meetingsData, error: meetingsError } = await supabase
      .from("meetings")
      .select("*")
      .gte("meeting_date", thirtyDaysAgo.toISOString())
      .order("meeting_date", { ascending: false });

    if (meetingsError) throw meetingsError;

    const meetings = meetingsData || [];

    // Group meetings by language
    const meetingsByLanguage = new Map<string, Meeting[]>();
    const languageIds = new Set<string>();

    meetings.forEach((meeting) => {
      languageIds.add(meeting.language_id);
      const existing = meetingsByLanguage.get(meeting.language_id) || [];
      existing.push(meeting);
      meetingsByLanguage.set(meeting.language_id, existing);
    });

    // Fetch language details
    const languagesWithMeetings: MonthlyReportData["languagesWithMeetings"] = [];

    const languageMap = await getLanguagesByIds([...meetingsByLanguage.keys()]);
    for (const [languageId, langMeetings] of meetingsByLanguage.entries()) {
      const language = languageMap.get(languageId);
      if (language) {
        languagesWithMeetings.push({
          language,
          meetings: langMeetings.sort((a, b) =>
            new Date(b.meeting_date).getTime() - new Date(a.meeting_date).getTime()
          ),
        });
      }
    }

    // Sort languages alphabetically
    languagesWithMeetings.sort((a, b) =>
      a.language.language.localeCompare(b.language.language)
    );

    return {
      monthStart: thirtyDaysAgo,
      monthEnd: now,
      totalMeetings: meetings.length,
      totalLanguages: languagesWithMeetings.length,
      languagesWithMeetings,
    };
  } catch (error) {
    console.error("Error fetching monthly report:", error);
    throw error;
  }
}

/**
 * Get daily report data - meetings for a specific date grouped by language
 */
export interface DailyReportData {
  selectedDate: Date;
  totalMeetings: number;
  totalLanguages: number;
  languagesWithMeetings: Array<{
    language: Language;
    meetings: Meeting[];
  }>;
}

export async function getDailyReport(selectedDate: Date = new Date()): Promise<DailyReportData> {
  try {
    // Normalize date to start and end of day
    const startDate = new Date(selectedDate);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(selectedDate);
    endDate.setHours(23, 59, 59, 999);

    // Fetch meetings for the specific date
    const { data: meetingsData, error: meetingsError } = await supabase
      .from("meetings")
      .select("*")
      .gte("meeting_date", startDate.toISOString())
      .lte("meeting_date", endDate.toISOString())
      .order("meeting_date", { ascending: false });

    if (meetingsError) throw meetingsError;

    const meetings = meetingsData || [];

    // Group meetings by language
    const meetingsByLanguage = new Map<string, Meeting[]>();

    meetings.forEach((meeting) => {
      const existing = meetingsByLanguage.get(meeting.language_id) || [];
      existing.push(meeting);
      meetingsByLanguage.set(meeting.language_id, existing);
    });

    // Fetch language details
    const languagesWithMeetings: DailyReportData["languagesWithMeetings"] = [];

    const languageMap = await getLanguagesByIds([...meetingsByLanguage.keys()]);
    for (const [languageId, langMeetings] of meetingsByLanguage.entries()) {
      const language = languageMap.get(languageId);
      if (language) {
        languagesWithMeetings.push({
          language,
          meetings: langMeetings.sort((a, b) =>
            new Date(b.meeting_date).getTime() - new Date(a.meeting_date).getTime()
          ),
        });
      }
    }

    // Sort languages alphabetically
    languagesWithMeetings.sort((a, b) =>
      a.language.language.localeCompare(b.language.language)
    );

    return {
      selectedDate,
      totalMeetings: meetings.length,
      totalLanguages: languagesWithMeetings.length,
      languagesWithMeetings,
    };
  } catch (error) {
    console.error("Error fetching daily report:", error);
    throw error;
  }
}

/**
 * Get meetings within a date range grouped by language
 */
export interface DateRangeReportData {
  startDate: Date;
  endDate: Date;
  totalMeetings: number;
  totalLanguages: number;
  languagesWithMeetings: Array<{
    language: Language;
    meetings: Meeting[];
  }>;
}

export async function getMeetingsByDateRange(
  startDate: Date,
  endDate: Date
): Promise<DateRangeReportData> {
  try {
    // Normalize start date to beginning of day
    const normalizedStart = new Date(startDate);
    normalizedStart.setHours(0, 0, 0, 0);
    
    // Normalize end date to end of day
    const normalizedEnd = new Date(endDate);
    normalizedEnd.setHours(23, 59, 59, 999);

    // Fetch meetings within the date range
    const { data: meetingsData, error: meetingsError } = await supabase
      .from("meetings")
      .select("*")
      .gte("meeting_date", normalizedStart.toISOString())
      .lte("meeting_date", normalizedEnd.toISOString())
      .order("meeting_date", { ascending: false });

    if (meetingsError) throw meetingsError;

    const meetings = meetingsData || [];

    // Group meetings by language
    const meetingsByLanguage = new Map<string, Meeting[]>();

    meetings.forEach((meeting) => {
      const existing = meetingsByLanguage.get(meeting.language_id) || [];
      existing.push(meeting);
      meetingsByLanguage.set(meeting.language_id, existing);
    });

    // Fetch language details
    const languagesWithMeetings: DateRangeReportData["languagesWithMeetings"] = [];

    const languageMap = await getLanguagesByIds([...meetingsByLanguage.keys()]);
    for (const [languageId, langMeetings] of meetingsByLanguage.entries()) {
      const language = languageMap.get(languageId);
      if (language) {
        languagesWithMeetings.push({
          language,
          meetings: langMeetings.sort((a, b) =>
            new Date(b.meeting_date).getTime() - new Date(a.meeting_date).getTime()
          ),
        });
      }
    }

    // Sort languages alphabetically
    languagesWithMeetings.sort((a, b) =>
      a.language.language.localeCompare(b.language.language)
    );

    return {
      startDate: normalizedStart,
      endDate: normalizedEnd,
      totalMeetings: meetings.length,
      totalLanguages: languagesWithMeetings.length,
      languagesWithMeetings,
    };
  } catch (error) {
    console.error("Error fetching meetings by date range:", error);
    throw error;
  }
}

/**
 * Get all meetings with language data filtered by date range
 */
export async function getMeetingsByDateRangeWithLanguage(
  startDate: Date | null,
  endDate: Date | null
): Promise<MeetingWithLanguage[]> {
  try {
    let query = supabase
      .from("meetings")
      .select(`
        *,
        languages:language_id (
          id,
          country,
          language,
          responsible_person,
          priority,
          work_status,
          last_meeting_at,
          project_id,
          created_at,
          updated_at
        )
      `);

    // Apply date filters if provided
    if (startDate) {
      const normalizedStart = new Date(startDate);
      normalizedStart.setHours(0, 0, 0, 0);
      query = query.gte("meeting_date", normalizedStart.toISOString());
    }

    if (endDate) {
      const normalizedEnd = new Date(endDate);
      normalizedEnd.setHours(23, 59, 59, 999);
      query = query.lte("meeting_date", normalizedEnd.toISOString());
    }

    const { data: meetingsData, error } = await query.order("meeting_date", { ascending: false });

    if (error) throw error;

    return (meetingsData || []).map((row: any) => ({
      meeting: {
        id: row.id,
        language_id: row.language_id,
        meeting_date: row.meeting_date,
        meeting_type: row.meeting_type,
        participants: row.participants,
        discussion_points: row.discussion_points,
        translation_progress: row.translation_progress,
        progress_percentage: row.progress_percentage,
        action_items: row.action_items,
        next_meeting_date: row.next_meeting_date,
        meeting_notes: row.meeting_notes,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
      language: row.languages as Language,
    }));
  } catch (error) {
    console.error("Error fetching meetings by date range with language:", error);
    throw error;
  }
}
