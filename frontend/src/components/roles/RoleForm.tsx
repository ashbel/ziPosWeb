import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';

const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  permissions: z.array(z.string()),
});

type FormValues = z.infer<typeof formSchema>;

export function RoleForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [availablePermissions, setAvailablePermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      permissions: [],
    },
  });

  useEffect(() => {
    fetchAvailablePermissions();
    if (id) {
      fetchRole();
    }
  }, [id]);

  const fetchAvailablePermissions = async () => {
    try {
      const response = await api.get('/roles/permissions/available');
      setAvailablePermissions(response.data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch available permissions',
        variant: 'destructive',
      });
    }
  };

  const fetchRole = async () => {
    try {
      const response = await api.get(`/roles/${id}`);
      form.reset(response.data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch role',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: FormValues) => {
    try {
      if (id) {
        await api.put(`/roles/${id}`, data);
        toast({
          title: 'Success',
          description: 'Role updated successfully',
        });
      } else {
        await api.post('/roles', data);
        toast({
          title: 'Success',
          description: 'Role created successfully',
        });
      }
      navigate('/roles');
    } catch (error) {
      toast({
        title: 'Error',
        description: id ? 'Failed to update role' : 'Failed to create role',
        variant: 'destructive',
      });
    }
  };

  if (loading && id) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">
        {id ? 'Edit Role' : 'Create Role'}
      </h1>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter role name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Enter role description"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="permissions"
            render={() => (
              <FormItem>
                <FormLabel>Permissions</FormLabel>
                <div className="grid grid-cols-2 gap-4">
                  {availablePermissions.map((permission) => (
                    <FormField
                      key={permission}
                      control={form.control}
                      name="permissions"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <Checkbox
                              checked={field.value?.includes(permission)}
                              onCheckedChange={(checked) => {
                                const newValue = checked
                                  ? [...field.value, permission]
                                  : field.value?.filter((p) => p !== permission);
                                field.onChange(newValue);
                              }}
                            />
                          </FormControl>
                          <FormLabel className="font-normal">
                            {permission}
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/roles')}
            >
              Cancel
            </Button>
            <Button type="submit">
              {id ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
} 