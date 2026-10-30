/*
 * French dictionary. Typed against en.ts (RawDictionary) so a missing or
 * mismatched key fails the type check.
 */

import type { RawDictionary } from './en';

export const dict: RawDictionary = {
  common: {
    loading: 'Chargement...',
    cancel: 'Annuler',
    confirm: 'Confirmer',
    ok: 'OK',
    save: 'Enregistrer',
    pleaseConfirm: 'Veuillez confirmer',
    somethingWentWrong: 'Une erreur est survenue',
    noData: 'Aucune donnée',
    yes: 'Oui',
    no: 'Non',
    none: '— Aucun —',
    typeToSearch: 'Tapez pour rechercher…',
    noMatches: 'Aucun résultat',
    clearSelection: 'Effacer la sélection',
    toggleOptions: 'Basculer les options',
    activeLabel: 'Actif : {{state}}',
    pbAdmin: 'Admin PB',
    noRole: 'Aucun rôle',
  },

  language: {
    label: 'Langue',
  },

  nav: {
    dashboard: 'Tableau de bord',
    media: 'Médias',
    categories: 'Catégories',
    products: 'Produits',
    statistics: 'Statistiques',
    activities: 'Activités',
    apiDocs: 'Documentation API',
    users: 'Utilisateurs',
    tenants: 'Clients',
    apiKeys: 'Clés API',
    superusers: 'Superutilisateurs',
    settings: 'Paramètres',
    general: 'Général',
    backup: 'Sauvegarde',
    oidc: 'OIDC',
    smtp: 'SMTP',
    security: 'Sécurité',
    about: 'À propos de STJÓRNA',
  },

  header: {
    tenantLogoAlt: 'Logo du client',
  },

  userMenu: {
    profile: 'Profil',
    logout: 'Se déconnecter',
  },

  tenantSelector: {
    selectTenant: 'Sélectionner un client...',
    instanceSettings: "Paramètres de l'instance",
    system: 'Système',
    tenants: 'Clients',
    noTenants: 'Aucun client disponible',
    currentTenant: 'Client actuel : {{name}}. Changer de client',
  },

  mfaBanner: {
    prefix: "La MFA des superutilisateurs est désactivée — ",
    configureSmtp: 'configurer SMTP',
    middle: ', puis activez-la dans ',
    security: 'Sécurité',
    suffix: '.',
  },

  notFound: {
    title: '404 — Page introuvable',
  },

  auth: {
    signInToAccount: 'Connectez-vous à votre compte',
    superuserSignIn: 'Connexion superutilisateur',
    superuserLogin: 'Connexion superutilisateur',
    signIn: 'Se connecter',
    signingIn: 'Connexion...',
    email: 'E-mail',
    password: 'Mot de passe',
    or: 'ou',
    otpPrompt:
      "L'authentification à deux facteurs est activée. Saisissez le mot de passe à usage unique envoyé à votre adresse e-mail.",
    otpCode: 'Code OTP',
    verify: 'Vérifier',
    verifying: 'Vérification...',
    backToPassword: 'Revenir au mot de passe',
    noAuthMethod:
      "Aucune méthode d'authentification n'est activée. Veuillez contacter un administrateur.",
    firstTimeSetup: 'Première configuration ?',
    backToUserLogin: "Revenir à la connexion utilisateur",
    superuserErrorHint:
      "Si aucun superutilisateur n'existe encore, cliquez sur « Première configuration ? » ci-dessous pour en créer un.",
    loginFailed: 'Échec de la connexion',
    cannotReachServer:
      'Impossible de joindre le serveur PocketBase. Vérifiez qu\'il est démarré et accessible.',
    userNotFound: 'Utilisateur introuvable ou mot de passe incorrect.',
    serverError: 'Erreur serveur ({{status}}) : {{msg}}',
    loginFailedStatus: 'Échec de la connexion ({{status}})',
    checkPbLogs: 'consultez les journaux PB pour la cause sous-jacente.',
  },

  dashboard: {
    title: 'Tableau de bord',
    loadingStats: 'Chargement des statistiques...',
    products: 'Produits',
    categories: 'Catégories',
    media: 'Médias',
    users: 'Utilisateurs',
    tenants: 'Clients',
    quickActions: 'Actions rapides',
    addTenant: '+ Ajouter un client',
    addCategory: '+ Ajouter une catégorie',
    addMedia: '+ Ajouter un média',
    addProduct: '+ Ajouter un produit',
    recentActivity: 'Activité récente',
    noRecentActivity: 'Aucune activité récente',
  },

  activity: {
    type: 'Type',
    action: 'Action',
    name: 'Nom',
    when: 'Quand',
    tenant: 'Client',
    record: 'Enregistrement',
  },

  settings: {
    title: 'Paramètres',
    tenantSettings: 'Paramètres du client',
    companyName: "Nom de l'entreprise",
    slug: 'Slug',
    plan: 'Formule',
    customDomain: 'Domaine personnalisé',
    selectPlan: 'Sélectionner une formule',
    planFree: 'Gratuit',
    planStarter: 'Starter',
    planProfessional: 'Professionnel',
    planEnterprise: 'Entreprise',
    saveSettings: 'Enregistrer les paramètres',
    saving: 'Enregistrement...',
    savedSuccessfully: 'Paramètres enregistrés avec succès !',
    noTenantSelected:
      "Aucun client sélectionné. Veuillez utiliser le sélecteur de client dans l'en-tête.",
    useTenantSelector:
      "Utilisez le sélecteur de client dans l'en-tête pour sélectionner un client.",
    failedToLoad: 'Échec du chargement des paramètres du client',
    failedToSave: "Échec de l'enregistrement",
  },

  profile: {
    title: 'Profil',
    account: 'Compte',
    email: 'E-mail',
    role: 'Rôle',
    currentTenant: 'Client actuel',
    created: 'Créé',
    emailVerified: 'E-mail vérifié',
    changePassword: 'Changer le mot de passe',
    currentPassword: 'Mot de passe actuel',
    newPassword: 'Nouveau mot de passe',
    confirmNewPassword: 'Confirmer le nouveau mot de passe',
    updatePassword: 'Mettre à jour le mot de passe',
    updating: 'Mise à jour...',
    passwordUpdated: 'Mot de passe mis à jour. Vous restez connecté.',
    security: 'Sécurité',
    passwordBadge: 'Mot de passe',
    emailOtpBadge: 'OTP e-mail',
    ssoBadge: 'SSO / OIDC',
    mfaBadge: 'MFA imposée',
    noLoginMethod:
      "Aucune méthode de connexion n'est activée pour ce type de compte. Contactez un administrateur.",
    enableEmailOtp: "Activer l'OTP par e-mail",
    enableEmailOtpHint: "S'applique à tous les superutilisateurs. Nécessite SMTP.",
    enforceMfa: 'Imposer la MFA',
    enforceMfaHint:
      "Nécessite l'activation du mot de passe + OTP. S'applique à tous les superutilisateurs.",
    saveSecuritySettings: 'Enregistrer les paramètres de sécurité',
    securitySettingsSaved: 'Paramètres de sécurité enregistrés.',
    saving: 'Enregistrement...',
    mfaManagedByAdmin:
      "L'authentification multifacteur est gérée par votre administrateur.",
    appearance: 'Apparence',
    appearanceHint:
      "Choisissez l'apparence de l'application. Système suit les préférences de votre système d'exploitation et réagit aux changements en direct.",
    theme: 'Thème',
    themeLight: 'Clair',
    themeDark: 'Sombre',
    themeSystem: 'Système',
    currently: 'Actuellement :',
    systemCurrently: 'Système (actuellement {{mode}})',
    operationFailed: "Échec de l'opération",
    cannotReachServer: 'Impossible de joindre le serveur PocketBase.',
    allFieldsRequired: 'Tous les champs de mot de passe sont obligatoires.',
    min8Chars: 'Le nouveau mot de passe doit comporter au moins 8 caractères.',
    mismatch: 'Le nouveau mot de passe et la confirmation ne correspondent pas.',
    mustDiffer: 'Le nouveau mot de passe doit être différent de l\'actuel.',
  },

  about: {
    title: 'À propos de STJÓRNA',
    tagline: 'Gestion de produits multi-clients avec une API REST en lecture seule.',
    signedInAs: 'Vous êtes connecté en tant que {{email}}.',
    unknownUser: 'utilisateur inconnu',
    projectLinks: 'Liens du projet',
    sourceCode: 'Code source (GitHub)',
    projectWebsite: "Site web du projet & documentation d'installation",
    buildInfo: 'Informations de build',
    version: 'Version',
    commit: 'Commit',
    built: 'Compilé',
    loadingVersion: 'Chargement de la version…',
    versionNotAvailable:
      "Informations de version non disponibles ({{error}}). Cela signifie généralement que l'image en cours a été compilée avant l'ajout du cachet de version ; recompilez depuis main pour renseigner /version.json.",
    ossDeps: 'Dépendances open source',
    ossDepsHint:
      "STJÓRNA est sous licence AGPL-3.0 et repose sur les bibliothèques suivantes. Les informations de licence transitives complètes sont fournies avec l'arborescence source.",
    roleBackend: 'Backend',
    roleFrontend: 'Frontend',
    roleStyling: 'Style',
    roleTooling: 'Outillage',
    roleDeployment: 'Déploiement',
    footer: 'STJÓRNA — open source sous licence AGPL-3.0.',
  },

  setup: {
    subtitle: 'Première configuration',
    stepSuperuser: '1. Superutilisateur',
    stepStorage: '2. Stockage',
    stepTenant: '3. Client',
    stepLink: '4. Liaison',
    bootstrapIntro:
      "Aucun superutilisateur PocketBase n'existe encore. Créez le premier — il peut administrer chaque client de cette instance, choisissez donc quelque chose de mémorable. Vous avez également besoin du jeton de configuration à usage unique du serveur.",
    loginIntro:
      "Connectez-vous avec le superutilisateur PocketBase existant. (Les installations Helm et Docker Compose le créent à partir de PB_SUPERUSER_EMAIL / PB_SUPERUSER_PASSWORD.)",
    superuserEmail: 'E-mail du superutilisateur',
    password: 'Mot de passe',
    confirmPassword: 'Confirmer le mot de passe',
    setupToken: 'Jeton de configuration',
    tokenHintEnv:
      'La valeur de la variable d\'environnement STJORNA_SETUP_TOKEN sur le serveur PocketBase.',
    tokenHintLog:
      'Affiché au démarrage dans le journal du serveur PocketBase sous la forme STJORNA_SETUP_TOKEN=… (ex. docker compose logs pocketbase / kubectl logs).',
    creating: 'Création...',
    loggingIn: 'Connexion...',
    createSuperuser: 'Créer le superutilisateur et continuer',
    continue: 'Continuer',
    storageIntro: 'Choisissez comment STJÓRNA doit stocker les fichiers importés :',
    storageLocalTitle: 'Système de fichiers local (par défaut)',
    storageLocalDesc:
      'Les fichiers sont stockés dans le conteneur PocketBase sous pb_data/storage/. Idéal pour le développement. Montez un volume en production pour conserver les données.',
    storageS3Title: 'S3 (ou compatible S3)',
    storageS3Desc:
      'Les fichiers sont stockés dans un bucket S3. Fonctionne avec AWS S3, Cloudflare R2, Backblaze B2, MinIO, etc. Nécessite un redémarrage de PocketBase après la configuration.',
    bucket: 'Bucket *',
    region: 'Région *',
    endpoint: 'Endpoint *',
    accessKey: "Clé d'accès *",
    secretKey: 'Clé secrète *',
    endpointHint: 'Rempli automatiquement depuis la région pour AWS, à surcharger pour R2 / B2 / MinIO',
    forcePathStyle: "Forcer l'adressage par chemin (MinIO, S3 local)",
    testing: 'Test…',
    verifyS3: 'Vérifier les paramètres S3',
    testRecordNote:
      "Si un enregistrement de test a été créé, il apparaîtra dans la liste des médias avec le nom de fichier __stjorna_s3_test__. Vous pouvez le supprimer sans risque.",
    clickVerify: 'Cliquez sur « Vérifier les paramètres S3 » avant de continuer.',
    tenantIntro:
      'Créez votre premier client (un client existant avec le même slug est réutilisé) :',
    companyName: "Nom de l'entreprise",
    slug: 'Slug',
    saving: 'Enregistrement...',
    linkIntro:
      "Un compte administrateur de client ({{email}}) est créé dans {{where}} {{slug}}. Il est distinct du superutilisateur et reçoit son propre mot de passe. Si un utilisateur avec cet e-mail existe déjà, il est lié tel quel et les champs ci-dessous sont ignorés.",
    linkWhereNew: 'le nouveau client',
    linkWhereExisting: "le client existant",
    tenantAdminPassword: "Mot de passe de l'administrateur du client",
    tenantAdminPasswordHint:
      'Au moins 10 caractères, différent du mot de passe du superutilisateur.',
    confirmTenantAdminPassword: "Confirmer le mot de passe de l'administrateur du client",
    linking: 'Liaison...',
    completeSetup: 'Terminer la configuration',
    doneTitle: 'Configuration terminée !',
    s3Active: 'Stockage S3 actif',
    s3ActiveDesc: 'Les nouveaux imports seront stockés dans le bucket {{bucket}}.',
    localStorageDesc: 'Utilisation du stockage sur système de fichiers local.',
    redirecting: 'Redirection vers la connexion...',
    sessionExpired: 'Session superutilisateur expirée — veuillez vous reconnecter.',
    passwordMismatch: 'Le mot de passe et la confirmation ne correspondent pas',
    tokenRequired: 'Le jeton de configuration est requis',
    loginFailed: 'Échec de la connexion du superutilisateur',
    s3FieldsRequired: 'Veuillez remplir tous les champs S3 obligatoires',
    couldNotSaveS3: "Impossible d'enregistrer les paramètres S3 : {{msg}}",
    createTenantFailed: 'Échec de la création du client',
    tenantNotFound: 'Client introuvable — revenez en arrière d\'une étape',
    adminPasswordMin: "Le mot de passe administrateur du client doit comporter au moins 10 caractères",
    adminPasswordMismatch:
      "Le mot de passe administrateur du client et sa confirmation ne correspondent pas",
    adminPasswordSameAsSuperuser:
      'Le mot de passe administrateur du client doit différer de celui du superutilisateur',
    linkAdminFailed: "Échec de la liaison de l'administrateur au client",
    s3MimeType:
      "Type MIME du fichier de test non autorisé par la collection de médias. (Ceci est un bug de l'assistant, pas de votre S3.)",
    s3MissingFile: "Fichier de test manquant. (Ceci est un bug de l'assistant.)",
    s3ValidationFailed: 'Échec de la validation du fichier : {{msg}}',
    s3TestFailed: 'Échec du test S3',
    s3AuthFailed: "Authentification impossible. Vérifiez la clé d'accès et la clé secrète.",
    s3BucketMissing: "Le bucket n'existe pas. Vérifiez le nom du bucket.",
    s3AccessDenied:
      "Accès refusé. Vérifiez les autorisations IAM de la clé d'accès (nécessite s3:PutObject, s3:GetObject, s3:DeleteObject).",
    s3EndpointInvalid:
      "L'URL de l'endpoint est invalide ou inaccessible. Vérifiez l'endpoint et la région.",
    s3GenericError:
      "Échec de la requête S3 (PocketBase a renvoyé une erreur générique). Vérifiez les identifiants, le bucket, la région, l'endpoint et les autorisations IAM. ({{raw}})",
    s3HttpError:
      "S3 a renvoyé une erreur. Vérifiez les identifiants, le bucket, la région, l'endpoint et les autorisations IAM. ({{raw}})",
    s3UploadFailed: "Échec de l'import vers S3 : {{msg}}",
    s3FileTokenFailed: "Impossible d'obtenir le jeton de fichier : {{msg}}",
    s3FileUrlUnreachable: "URL du fichier S3 inaccessible : {{msg}}",
    s3FileNotAccessible: 'Fichier S3 non accessible : HTTP {{status}}',
    s3VerifiedButNotDeleted:
      "Connexion S3 vérifiée. L'enregistrement de test (id : {{id}}) a été créé mais n'a pas pu être supprimé automatiquement — supprimez-le de la liste des médias.",
    s3Verified:
      "Connexion S3 vérifiée (bucket : {{bucket}}, région : {{region}}, endpoint : {{endpoint}}). Continuez pour terminer la configuration.",
  },
};
