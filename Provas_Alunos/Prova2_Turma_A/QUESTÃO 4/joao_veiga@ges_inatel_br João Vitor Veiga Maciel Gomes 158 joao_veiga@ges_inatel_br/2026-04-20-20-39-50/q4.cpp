#include <iostream>
#include <string>

using namespace std;

int main ()
{
    
    int v[10];
    int contador = 0;
    int media = 0;
    int i;
    
    while ( i != 0)
    {
        cin >> v[i];
        
        media = ( i / contador);
        
        if (media > 0)
        {
            cout << "positivos" << endl;
        }
        
        else if (media < 0)
        {
            cout <<"negativos" << endl;
        }
        
    }
    
    cout << "media = " << media << endl;
    
    return 0;
}