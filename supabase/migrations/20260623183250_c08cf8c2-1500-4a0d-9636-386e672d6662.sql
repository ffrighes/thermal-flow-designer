
REVOKE EXECUTE ON FUNCTION public.is_project_owner(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_project_owner(UUID) TO authenticated, service_role;
