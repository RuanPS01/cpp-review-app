#include <iostream>
using namespace std;

int main()
{
    int n, ids[10000], id;
    
    //n de clientes
    cin >> n;
    
    //id dos clientes
    for (int i = 0; i < n; i++)
    {
        cin >> ids[i];
    }
    
    //pagos
    for (int p = 0; p < n; p++)
    {
      cin >> id;
      
      if (id == ids[p])
      {
          ids[p] =-1;
      }
    }
    
    //saida 
    for (int s = 0; s < n; s++)
    {
        cout << ids[s] << " ";
    }
    
    return 0;
}