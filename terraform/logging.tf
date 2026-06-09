# Cloud Logging: Log-based metric for deployment events
resource "google_logging_metric" "deploy_events" {
  project = var.project_id
  name    = "cidyt_deploy_events"
  filter  = "resource.type=\"global\" AND logName=\"projects/${var.project_id}/logs/cidyt-deploy\""

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    unit        = "1"

    labels {
      key         = "status"
      value_type  = "STRING"
      description = "Deployment status (success/failure)"
    }
  }

  label_extractors = {
    "status" = "EXTRACT(jsonPayload.status)"
  }
}

# Log sink to ensure deploy logs are retained
resource "google_logging_project_sink" "deploy_sink" {
  project                = var.project_id
  name                   = "cidyt-deploy-sink"
  destination            = "logging.googleapis.com/projects/${var.project_id}/locations/${var.region}/buckets/_Default"
  filter                 = "logName=\"projects/${var.project_id}/logs/cidyt-deploy\""
  unique_writer_identity = true
}
