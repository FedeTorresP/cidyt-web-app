output "hosting_site_url" {
  description = "Firebase Hosting default URL"
  value       = "https://${google_firebase_hosting_site.default.site_id}.web.app"
}

output "hosting_site_id" {
  description = "Firebase Hosting site ID"
  value       = google_firebase_hosting_site.default.site_id
}

output "deploy_log_metric" {
  description = "Cloud Logging metric for deploy events"
  value       = google_logging_metric.deploy_events.name
}
