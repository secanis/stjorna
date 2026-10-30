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
};
