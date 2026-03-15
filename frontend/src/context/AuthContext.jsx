import { createContext, useContext, useState, useEffect, useRef } from "react"
import { getMe } from "../api/auth"

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(localStorage.getItem("token"))
  const [loading, setLoading] = useState(true)
  const authRequestRef = useRef(0)

  useEffect(() => {
    const requestId = ++authRequestRef.current

    const loadUser = async () => {
      setLoading(true)

      if (!token) {
        setUser(null)
        setLoading(false)
        return
      }

      try {
        const res = await getMe(token)
        if (authRequestRef.current !== requestId) return
        setUser(res.data)
      } catch {
        if (authRequestRef.current !== requestId) return
        localStorage.removeItem("token")
        setUser(null)
        setToken(null)
      } finally {
        if (authRequestRef.current !== requestId) return
        setLoading(false)
      }
    }

    loadUser()
  }, [token])

  const completeLogin = ({ accessToken, user: nextUser }) => {
    localStorage.setItem("token", accessToken)
    setToken(accessToken)
    setUser(nextUser)
    setLoading(false)
  }

  const logout = () => {
    localStorage.removeItem("token")
    setUser(null)
    setToken(null)
    setLoading(false)
  }

  return (
    <AuthContext.Provider
      value={{ user, setUser, token, setToken, logout, loading, completeLogin }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)