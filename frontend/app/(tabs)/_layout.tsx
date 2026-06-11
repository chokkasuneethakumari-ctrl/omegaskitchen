import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import React, { useEffect, useRef } from "react";

import { api, ApiError, QueueResponse } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";
import { useAuth } from "@/src/context/AuthContext";
import { C, F } from "@/src/theme";

// Watches the user's active order and fires in-app notifications
// when the kitchen starts cooking / order is ready / picked up.
function OrderStatusWatcher() {
  const toast = useToast();
  const lastOrderId = useRef<string | null>(null);
  const lastStatus = useRef<string | null>(null);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    let stopped = false;
    const check = async () => {
      if (stopped) return;
      try {
        const res = await api<QueueResponse>("/orders/queue");
        const order = res.my_active_order;
        if (order) {
          if (
            lastOrderId.current === order.id &&
            lastStatus.current &&
            lastStatus.current !== order.status
          ) {
            if (order.status === "cooking") {
              toast.show("👨‍🍳 The kitchen started cooking your order!", "info");
            }
            if (order.status === "ready") {
              toast.show("🎉 Your order is ready — come pick it up!");
            }
          }
          lastOrderId.current = order.id;
          lastStatus.current = order.status;
        } else {
          if (lastStatus.current === "ready") {
            toast.show("✅ Order picked up. Enjoy your meal!");
          }
          lastOrderId.current = null;
          lastStatus.current = null;
        }
      } catch (e) {
        // Expired/invalid session: stop polling instead of spinning forever.
        if (e instanceof ApiError && e.status === 401) {
          stopped = true;
          if (interval) clearInterval(interval);
        }
        // otherwise: silent poll failure
      }
    };
    check();
    interval = setInterval(check, 12000);
    return () => {
      stopped = true;
      if (interval) clearInterval(interval);
    };
  }, [toast]);

  return null;
}

export default function TabsLayout() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Redirect href="/" />;

  return (
    <>
      <OrderStatusWatcher />
      <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.brand,
        tabBarInactiveTintColor: C.textTertiary,
        tabBarStyle: {
          backgroundColor: C.card,
          borderTopColor: C.border,
        },
        tabBarLabelStyle: { fontFamily: F.medium, fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Menu",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "restaurant" : "restaurant-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="queue"
        options={{
          title: "Queue",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "time" : "time-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          title: "Wishes",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "sparkles" : "sparkles-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "person" : "person-outline"} size={22} color={color} />
          ),
        }}
      />
    </Tabs>
    </>
  );
}
