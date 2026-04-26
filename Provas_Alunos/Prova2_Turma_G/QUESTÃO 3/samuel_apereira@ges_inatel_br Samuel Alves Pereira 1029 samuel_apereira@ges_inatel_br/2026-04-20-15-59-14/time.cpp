#include <iostream>
#include <iomanip>
using namespace std;


int main()
{
    int a;
    cin >> a;
    
    int len = 0;
    int biggestTime = 0;
    int sum = 0;
    
    while (a != 0)
    {
        len++;
        sum += a;
        
        if (a > biggestTime)
            biggestTime = a;
        
        cin >> a;
    }
    
    float even = sum / (len * 1.0);
    
    cout << fixed << setprecision(2);
    cout << "Maior tempo: " << biggestTime << " minutos" << endl;
    cout << "Media dos tempos: " << even << " minutos" << endl;
    
    return 0;
}