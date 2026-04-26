#include <iostream>

using namespace std;

int main ()
{
    
    int x;
    int contador = 0;
    int impar = 0;
    
    
    for (int i = 0 ; i < x ; i++)
    {
       cin >> x;
       
        if (x % 2 != 0)
        {
            impar++;
            contador += x;
        }
        
        cout << " " << contador;
    }
    

    return 0;
}