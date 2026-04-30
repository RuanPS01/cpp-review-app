#include <iostream>
using namespace std;

int main()
{
    int n, cliente[100];
    cin >> n;
    
    for(int i = 0; i < n; i++)
    {
        cin >> cliente[i];
    }
    
    int pago;
    cin >> pago;
    
    for (int i = 0; i < n; i++)
    {
        if(cliente[i] == pago)
        {
            cliente[i] = -1;
        }
    }
    
    for(int i = 0; i < n; i++)
    {
        cout << cliente[i] << " ";
    }
    
    
    return 0;
}