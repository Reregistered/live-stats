live-stats
==========

Adds a shared memory live stats object on top of statsd. Allows realtime monitoring to implement business logic on a separate channel on top of metrics which are already intended for statsd collecting. Needs statsd-node to work properly and redis as the shared mem backend.