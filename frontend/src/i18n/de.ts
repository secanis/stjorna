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

  setup: {
    subtitle: 'Ersteinrichtung',
    stepSuperuser: '1. Superuser',
    stepStorage: '2. Speicher',
    stepTenant: '3. Mandant',
    stepLink: '4. Verknüpfung',
    bootstrapIntro:
      'Es existiert noch kein PocketBase-Superuser. Legen Sie den ersten an — er kann jeden Mandanten dieser Instanz verwalten, wählen Sie also etwas Einprägsames. Sie benötigen außerdem das einmalige Setup-Token vom Server.',
    loginIntro:
      'Melden Sie sich mit dem bereits vorhandenen PocketBase-Superuser an. (Helm- und Docker-Compose-Installationen erstellen ihn aus PB_SUPERUSER_EMAIL / PB_SUPERUSER_PASSWORD.)',
    superuserEmail: 'Superuser-E-Mail',
    password: 'Passwort',
    confirmPassword: 'Passwort bestätigen',
    setupToken: 'Setup-Token',
    tokenHintEnv:
      'Der Wert der Umgebungsvariable STJORNA_SETUP_TOKEN auf dem PocketBase-Server.',
    tokenHintLog:
      'Wird beim Start im PocketBase-Serverprotokoll als STJORNA_SETUP_TOKEN=… ausgegeben (z. B. docker compose logs pocketbase / kubectl logs).',
    creating: 'Wird erstellt...',
    loggingIn: 'Anmeldung läuft...',
    createSuperuser: 'Superuser erstellen & fortfahren',
    continue: 'Weiter',
    storageIntro: 'Wählen Sie, wie STJÓRNA hochgeladene Dateien speichern soll:',
    storageLocalTitle: 'Lokales Dateisystem (Standard)',
    storageLocalDesc:
      'Dateien werden im PocketBase-Container unter pb_data/storage/ gespeichert. Am besten für die Entwicklung. Mounten Sie in Produktion unbedingt ein Volume, um Daten dauerhaft zu sichern.',
    storageS3Title: 'S3 (oder S3-kompatibel)',
    storageS3Desc:
      'Dateien werden in einem S3-Bucket gespeichert. Funktioniert mit AWS S3, Cloudflare R2, Backblaze B2, MinIO usw. Erfordert einen Neustart von PocketBase nach der Einrichtung.',
    bucket: 'Bucket *',
    region: 'Region *',
    endpoint: 'Endpoint *',
    accessKey: 'Access Key *',
    secretKey: 'Secret Key *',
    endpointHint: 'Für AWS automatisch aus der Region übernommen, für R2 / B2 / MinIO überschreiben',
    forcePathStyle: 'Path-Style-Adressierung erzwingen (MinIO, lokales S3)',
    testing: 'Wird getestet…',
    verifyS3: 'S3-Einstellungen prüfen',
    testRecordNote:
      'Falls ein Testdatensatz erstellt wurde, erscheint er in der Medienliste mit dem Dateinamen __stjorna_s3_test__. Sie können ihn bedenkenlos löschen.',
    clickVerify: 'Klicken Sie vor dem Fortfahren auf „S3-Einstellungen prüfen“.',
    tenantIntro:
      'Erstellen Sie Ihren ersten Mandanten (ein vorhandener Mandant mit demselben Slug wird wiederverwendet):',
    companyName: 'Firmenname',
    slug: 'Slug',
    saving: 'Wird gespeichert...',
    linkIntro:
      'Ein Mandanten-Admin-Konto ({{email}}) wird in {{where}} {{slug}} erstellt. Es ist vom Superuser getrennt und erhält ein eigenes Passwort. Existiert bereits ein Benutzer mit dieser E-Mail, wird er unverändert verknüpft und die folgenden Felder werden ignoriert.',
    linkWhereNew: 'dem neuen Mandanten',
    linkWhereExisting: 'dem vorhandenen Mandanten',
    tenantAdminPassword: 'Mandanten-Admin-Passwort',
    tenantAdminPasswordHint:
      'Mindestens 10 Zeichen, abweichend vom Superuser-Passwort.',
    confirmTenantAdminPassword: 'Mandanten-Admin-Passwort bestätigen',
    linking: 'Wird verknüpft...',
    completeSetup: 'Einrichtung abschließen',
    doneTitle: 'Einrichtung abgeschlossen!',
    s3Active: 'S3-Speicher aktiv',
    s3ActiveDesc: 'Neue Uploads werden im Bucket {{bucket}} gespeichert.',
    localStorageDesc: 'Es wird lokaler Dateisystem-Speicher verwendet.',
    redirecting: 'Weiterleitung zur Anmeldung...',
    sessionExpired: 'Superuser-Sitzung abgelaufen — bitte melden Sie sich erneut an.',
    passwordMismatch: 'Passwort und Bestätigung stimmen nicht überein',
    tokenRequired: 'Setup-Token ist erforderlich',
    loginFailed: 'Superuser-Anmeldung fehlgeschlagen',
    s3FieldsRequired: 'Bitte füllen Sie alle erforderlichen S3-Felder aus',
    couldNotSaveS3: 'S3-Einstellungen konnten nicht gespeichert werden: {{msg}}',
    createTenantFailed: 'Mandant konnte nicht erstellt werden',
    tenantNotFound: 'Mandant nicht gefunden — gehen Sie einen Schritt zurück',
    adminPasswordMin: 'Das Mandanten-Admin-Passwort muss mindestens 10 Zeichen lang sein',
    adminPasswordMismatch:
      'Mandanten-Admin-Passwort und Bestätigung stimmen nicht überein',
    adminPasswordSameAsSuperuser:
      'Das Mandanten-Admin-Passwort muss sich vom Superuser-Passwort unterscheiden',
    linkAdminFailed: 'Admin konnte nicht mit dem Mandanten verknüpft werden',
    s3MimeType:
      'Testdatei-MIME-Typ wird von der Medien-Sammlung nicht zugelassen. (Dies ist ein Assistenten-Fehler, nicht Ihr S3.)',
    s3MissingFile: 'Testdatei fehlt. (Dies ist ein Assistenten-Fehler.)',
    s3ValidationFailed: 'Dateivalidierung fehlgeschlagen: {{msg}}',
    s3TestFailed: 'S3-Test fehlgeschlagen',
    s3AuthFailed: 'Authentifizierung fehlgeschlagen. Prüfen Sie Access Key und Secret Key.',
    s3BucketMissing: 'Bucket existiert nicht. Prüfen Sie den Bucket-Namen.',
    s3AccessDenied:
      'Zugriff verweigert. Prüfen Sie die IAM-Berechtigungen des Access Keys (benötigt s3:PutObject, s3:GetObject, s3:DeleteObject).',
    s3EndpointInvalid:
      'Endpoint-URL ist ungültig oder nicht erreichbar. Prüfen Sie Endpoint und Region.',
    s3GenericError:
      'S3-Anfrage fehlgeschlagen (PocketBase gab einen generischen Fehler zurück). Prüfen Sie Zugangsdaten, Bucket, Region, Endpoint und IAM-Berechtigungen. ({{raw}})',
    s3HttpError:
      'S3 gab einen Fehler zurück. Prüfen Sie Zugangsdaten, Bucket, Region, Endpoint und IAM-Berechtigungen. ({{raw}})',
    s3UploadFailed: 'Upload zu S3 fehlgeschlagen: {{msg}}',
    s3FileTokenFailed: 'Datei-Token konnte nicht abgerufen werden: {{msg}}',
    s3FileUrlUnreachable: 'S3-Datei-URL nicht erreichbar: {{msg}}',
    s3FileNotAccessible: 'S3-Datei nicht zugänglich: HTTP {{status}}',
    s3VerifiedButNotDeleted:
      'S3-Verbindung verifiziert. Der Testdatensatz (id: {{id}}) wurde erstellt, konnte aber nicht automatisch gelöscht werden — bitte löschen Sie ihn aus der Medienliste.',
    s3Verified:
      'S3-Verbindung verifiziert (Bucket: {{bucket}}, Region: {{region}}, Endpoint: {{endpoint}}). Fahren Sie fort, um die Einrichtung abzuschließen.',
  },
};
