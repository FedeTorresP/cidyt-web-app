# Firebase Hosting site
resource "google_firebase_hosting_site" "default" {
  provider = google-beta
  project  = var.project_id
  site_id  = var.firebase_hosting_site
}

# Firebase Hosting release channel (live)
resource "google_firebase_hosting_channel" "live" {
  provider   = google-beta
  project    = var.project_id
  site_id    = google_firebase_hosting_site.default.site_id
  channel_id = "live"
}
