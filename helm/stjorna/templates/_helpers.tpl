{{/*
Expand the name of the chart.
*/}}
{{- define "stjorna.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some K8s name fields are limited to this (RFC 1123).
*/}}
{{- define "stjorna.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{/*
Create the name of the ServiceAccount to use.
*/}}
{{- define "stjorna.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{- default (include "stjorna.fullname" .) .Values.serviceAccount.name -}}
{{- else -}}
{{- default "default" .Values.serviceAccount.name -}}
{{- end -}}
{{- end -}}

{{/*
Common labels (applied to every resource).
*/}}
{{- define "stjorna.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{ include "stjorna.selectorLabels" . }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{/*
Selector labels (used in matchLabels; must be stable across upgrades).
*/}}
{{- define "stjorna.selectorLabels" -}}
app.kubernetes.io/name: {{ include "stjorna.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{/*
Component-specific selector labels.
*/}}
{{- define "stjorna.pocketbase.selectorLabels" -}}
{{ include "stjorna.selectorLabels" . }}
app.kubernetes.io/component: pocketbase
{{- end -}}

{{- define "stjorna.frontend.selectorLabels" -}}
{{ include "stjorna.selectorLabels" . }}
app.kubernetes.io/component: frontend
{{- end -}}

{{/*
PocketBase fullname helpers (for resources that need a stable name).
*/}}
{{- define "stjorna.pocketbase.fullname" -}}
{{- printf "%s-pocketbase" (include "stjorna.fullname" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "stjorna.frontend.fullname" -}}
{{- printf "%s-frontend" (include "stjorna.fullname" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
PB Secret name (auto-generated one).
*/}}
{{- define "stjorna.pocketbase.secretName" -}}
{{- if .Values.pocketbase.secret.existingSecret -}}
{{- .Values.pocketbase.secret.existingSecret -}}
{{- else -}}
{{- include "stjorna.pocketbase.fullname" . -}}
{{- end -}}
{{- end -}}
