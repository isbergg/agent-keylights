@echo off
rem Starts the AgentBoard light daemon (OpenRGB must be running with SDK Server on).
py "%~dp0agentlights.py" %*
