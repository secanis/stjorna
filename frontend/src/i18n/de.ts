/*
 * German dictionary. Typed against en.ts (RawDictionary) so a missing or
 * mismatched key fails the type check.
 */

import type { RawDictionary } from './en';

export const dict: RawDictionary = {
  common: {
    loading: 'Wird geladen...',
    cancel: 'Abbrechen',
    confirm: 'Bestätigen',
    ok: 'OK',
    save: 'Speichern',
    pleaseConfirm: 'Bitte bestätigen',
    somethingWentWrong: 'Etwas ist schiefgelaufen',
    noData: 'Keine Daten',
    yes: 'Ja',
    no: 'Nein',
    none: '— Keine —',
    typeToSearch: 'Zum Suchen tippen…',
    noMatches: 'Keine Treffer',
    clearSelection: 'Auswahl löschen',
    toggleOptions: 'Optionen umschalten',
    activeLabel: 'Aktiv: {{state}}',
    pbAdmin: 'PB-Admin',
    noRole: 'Keine Rolle',
  },

  language: {
    label: 'Sprache',
  },

  nav: {
    dashboard: 'Übersicht',
    media: 'Medien',
    categories: 'Kategorien',
    products: 'Produkte',
    statistics: 'Statistiken',
    activities: 'Aktivitäten',
    apiDocs: 'API-Dokumentation',
    users: 'Benutzer',
    tenants: 'Mandanten',
    apiKeys: 'API-Schlüssel',
    superusers: 'Superuser',
    settings: 'Einstellungen',
    general: 'Allgemein',
    backup: 'Backup',
    oidc: 'OIDC',
    smtp: 'SMTP',
    security: 'Sicherheit',
    about: 'Über STJÓRNA',
  },

  header: {
    tenantLogoAlt: 'Mandanten-Logo',
  },

  userMenu: {
    profile: 'Profil',
    logout: 'Abmelden',
  },

  tenantSelector: {
    selectTenant: 'Mandant wählen...',
    instanceSettings: 'Instanz-Einstellungen',
    system: 'System',
    tenants: 'Mandanten',
    noTenants: 'Keine Mandanten verfügbar',
    currentTenant: 'Aktueller Mandant: {{name}}. Mandant wechseln',
  },

  mfaBanner: {
    prefix: 'Superuser-MFA ist deaktiviert — ',
    configureSmtp: 'SMTP konfigurieren',
    middle: ', dann unter ',
    security: 'Sicherheit',
    suffix: ' aktivieren.',
  },

  notFound: {
    title: '404 — Seite nicht gefunden',
  },

  auth: {
    signInToAccount: 'Bei Ihrem Konto anmelden',
    superuserSignIn: 'Superuser-Anmeldung',
    superuserLogin: 'Superuser-Login',
    signIn: 'Anmelden',
    signingIn: 'Anmeldung läuft...',
    email: 'E-Mail',
    password: 'Passwort',
    or: 'oder',
    otpPrompt:
      'Zwei-Faktor-Authentifizierung ist aktiviert. Geben Sie das an Ihre E-Mail gesendete Einmalpasswort ein.',
    otpCode: 'OTP-Code',
    verify: 'Bestätigen',
    verifying: 'Wird geprüft...',
    backToPassword: 'Zurück zur Passworteingabe',
    noAuthMethod:
      'Keine Authentifizierungsmethode ist aktiviert. Bitte wenden Sie sich an einen Administrator.',
    firstTimeSetup: 'Ersteinrichtung?',
    backToUserLogin: 'Zurück zur Benutzeranmeldung',
    superuserErrorHint:
      "Wenn noch kein Superuser existiert, klicken Sie unten auf „Ersteinrichtung?“, um einen zu erstellen.",
    loginFailed: 'Anmeldung fehlgeschlagen',
    cannotReachServer:
      'PocketBase-Server nicht erreichbar. Prüfen Sie, ob er läuft und erreichbar ist.',
    userNotFound: 'Benutzer nicht gefunden oder Passwort falsch.',
    serverError: 'Serverfehler ({{status}}): {{msg}}',
    loginFailedStatus: 'Anmeldung fehlgeschlagen ({{status}})',
    checkPbLogs: 'prüfen Sie die PB-Logs auf die zugrunde liegende Ursache.',
  },

  dashboard: {
    title: 'Übersicht',
    loadingStats: 'Statistiken werden geladen...',
    products: 'Produkte',
    categories: 'Kategorien',
    media: 'Medien',
    users: 'Benutzer',
    tenants: 'Mandanten',
    quickActions: 'Schnellaktionen',
    addTenant: '+ Mandant hinzufügen',
    addCategory: '+ Kategorie hinzufügen',
    addMedia: '+ Medium hinzufügen',
    addProduct: '+ Produkt hinzufügen',
    recentActivity: 'Letzte Aktivitäten',
    noRecentActivity: 'Keine letzten Aktivitäten',
  },

  activity: {
    type: 'Typ',
    action: 'Aktion',
    name: 'Name',
    when: 'Zeitpunkt',
    tenant: 'Mandant',
    record: 'Datensatz',
  },

  settings: {
    title: 'Einstellungen',
    tenantSettings: 'Mandanten-Einstellungen',
    companyName: 'Firmenname',
    slug: 'Slug',
    plan: 'Tarif',
    customDomain: 'Eigene Domain',
    selectPlan: 'Tarif wählen',
    planFree: 'Kostenlos',
    planStarter: 'Starter',
    planProfessional: 'Professional',
    planEnterprise: 'Enterprise',
    saveSettings: 'Einstellungen speichern',
    saving: 'Wird gespeichert...',
    savedSuccessfully: 'Einstellungen erfolgreich gespeichert!',
    noTenantSelected:
      'Kein Mandant ausgewählt. Bitte verwenden Sie die Mandantenauswahl in der Kopfzeile.',
    useTenantSelector:
      'Verwenden Sie die Mandantenauswahl in der Kopfzeile, um einen Mandanten auszuwählen.',
    failedToLoad: 'Mandanten-Einstellungen konnten nicht geladen werden',
    failedToSave: 'Speichern fehlgeschlagen',
  },

  profile: {
    title: 'Profil',
    account: 'Konto',
    email: 'E-Mail',
    role: 'Rolle',
    currentTenant: 'Aktueller Mandant',
    created: 'Erstellt',
    emailVerified: 'E-Mail verifiziert',
    changePassword: 'Passwort ändern',
    currentPassword: 'Aktuelles Passwort',
    newPassword: 'Neues Passwort',
    confirmNewPassword: 'Neues Passwort bestätigen',
    updatePassword: 'Passwort aktualisieren',
    updating: 'Wird aktualisiert...',
    passwordUpdated: 'Passwort aktualisiert. Sie bleiben angemeldet.',
    security: 'Sicherheit',
    passwordBadge: 'Passwort',
    emailOtpBadge: 'E-Mail-OTP',
    ssoBadge: 'SSO / OIDC',
    mfaBadge: 'MFA erzwungen',
    noLoginMethod:
      'Für diesen Kontotyp ist keine Anmeldemethode aktiviert. Wenden Sie sich an einen Administrator.',
    enableEmailOtp: 'E-Mail-OTP aktivieren',
    enableEmailOtpHint: 'Gilt für alle Superuser. Erfordert SMTP.',
    enforceMfa: 'MFA erzwingen',
    enforceMfaHint:
      'Erfordert aktiviertes Passwort + OTP. Gilt für alle Superuser.',
    saveSecuritySettings: 'Sicherheitseinstellungen speichern',
    securitySettingsSaved: 'Sicherheitseinstellungen gespeichert.',
    saving: 'Wird gespeichert...',
    mfaManagedByAdmin:
      'Die Multi-Faktor-Authentifizierung wird von Ihrem Administrator verwaltet.',
    appearance: 'Darstellung',
    appearanceHint:
      'Wählen Sie, wie die App aussehen soll. System folgt Ihrer Betriebssystem-Einstellung und reagiert live auf Änderungen.',
    theme: 'Design',
    themeLight: 'Hell',
    themeDark: 'Dunkel',
    themeSystem: 'System',
    currently: 'Aktuell:',
    systemCurrently: 'System (aktuell {{mode}})',
    operationFailed: 'Vorgang fehlgeschlagen',
    cannotReachServer: 'PocketBase-Server nicht erreichbar.',
    allFieldsRequired: 'Alle Passwortfelder sind erforderlich.',
    min8Chars: 'Das neue Passwort muss mindestens 8 Zeichen lang sein.',
    mismatch: 'Neues Passwort und Bestätigung stimmen nicht überein.',
    mustDiffer: 'Das neue Passwort muss sich vom aktuellen unterscheiden.',
  },

  about: {
    title: 'Über STJÓRNA',
    tagline: 'Mandantenfähiges Produktmanagement mit einer schreibgeschützten REST-API.',
    signedInAs: 'Sie sind angemeldet als {{email}}.',
    unknownUser: 'unbekannter Benutzer',
    projectLinks: 'Projekt-Links',
    sourceCode: 'Quellcode (GitHub)',
    projectWebsite: 'Projekt-Website & Installationsdokumentation',
    buildInfo: 'Build-Informationen',
    version: 'Version',
    commit: 'Commit',
    built: 'Erstellt',
    loadingVersion: 'Version wird geladen…',
    versionNotAvailable:
      'Versionsinformationen nicht verfügbar ({{error}}). Dies bedeutet normalerweise, dass das laufende Image vor dem Hinzufügen des Versionsstempels erstellt wurde; erstellen Sie von main neu, um /version.json zu füllen.',
    ossDeps: 'Open-Source-Abhängigkeiten',
    ossDepsHint:
      'STJÓRNA ist unter AGPL-3.0 lizenziert und baut auf den folgenden Bibliotheken auf. Vollständige transitive Lizenzinformationen liegen dem Quellbaum bei.',
    roleBackend: 'Backend',
    roleFrontend: 'Frontend',
    roleStyling: 'Styling',
    roleTooling: 'Tooling',
    roleDeployment: 'Deployment',
    footer: 'STJÓRNA — Open Source unter AGPL-3.0.',
  },
};
